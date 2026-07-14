// Command cipherlane is the VPN control-plane server: it opens the store, seeds
// a demo estate, provisions bootstrap secrets, starts the live telemetry engine,
// and serves the REST + WebSocket API (and the built dashboard in production).
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"cipherlane/internal/api"
	"cipherlane/internal/auth"
	"cipherlane/internal/config"
	"cipherlane/internal/db"
	"cipherlane/internal/sim"
	"cipherlane/internal/vault"
	"cipherlane/internal/ws"
)

const defaultPasscode = "cipherlane"

func main() {
	cfg := config.Load()

	store, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	if err := db.Seed(store); err != nil {
		log.Fatalf("seed: %v", err)
	}

	// Open the vault (seals secrets at rest — MFA secrets, keys).
	vlt, err := vault.Open(cfg.VaultKeyPath)
	if err != nil {
		log.Fatalf("vault: %v", err)
	}

	secret := ensureSetting(store, "session_secret", func() (string, error) { return auth.NewSecret() })
	_ = ensureSetting(store, "passcode_hash", func() (string, error) {
		pc := os.Getenv("CIPHERLANE_PASSCODE")
		if pc == "" {
			pc = defaultPasscode
		}
		return auth.HashPasscode(pc)
	})
	_ = ensureSetting(store, "agent_token", func() (string, error) { return auth.NewSecret() })
	ensureOperators(store)

	hub := ws.NewHub(cfg.Dev)
	engine := sim.New(store.DB, hub)
	go engine.Run()

	srv := &api.Server{Cfg: cfg, DB: store, Sim: engine, Hub: hub, Secret: secret, Vault: vlt}
	httpSrv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("cipherlane control plane listening on %s (dev=%v)", cfg.Addr, cfg.Dev)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("shutting down…")
	engine.Stop()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(ctx)
}

// ensureSetting returns an existing setting or generates, stores, and returns it.
func ensureSetting(store *db.DB, key string, gen func() (string, error)) string {
	if v, ok := store.GetSetting(key); ok {
		return v
	}
	v, err := gen()
	if err != nil {
		log.Fatalf("bootstrap %s: %v", key, err)
	}
	if err := store.SetSetting(key, v); err != nil {
		log.Fatalf("store %s: %v", key, err)
	}
	return v
}

// ensureOperators seeds a demo team (one per role) on first boot; all share the
// default passcode until changed.
func ensureOperators(store *db.DB) {
	var n int
	_ = store.QueryRow("SELECT COUNT(*) FROM operators").Scan(&n)
	if n > 0 {
		return
	}
	hash, err := auth.HashPasscode(defaultPasscode)
	if err != nil {
		log.Fatalf("operator seed: %v", err)
	}
	now := time.Now().Unix()
	seed := []struct{ id, name, email, role string }{
		{"op_owner", "Aygun Mammadova", "owner@cipherlane.az", "owner"},
		{"op_admin", "Rashad Guliyev", "admin@cipherlane.az", "admin"},
		{"op_operator", "Kamran Aliyev", "operator@cipherlane.az", "operator"},
		{"op_auditor", "Nigar Sadigova", "auditor@cipherlane.az", "auditor"},
	}
	for _, o := range seed {
		_, _ = store.Exec(`INSERT INTO operators(id,name,email,role,password_hash,status,created_at,updated_at)
			VALUES(?,?,?,?,?,?,?,?)`, o.id, o.name, o.email, o.role, hash, "active", now, now)
	}
}
