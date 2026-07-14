package sim

import (
	"path/filepath"
	"testing"
	"time"

	"cipherlane/internal/db"
	"cipherlane/internal/ws"
)

// TestEvaluateAlertsNoDeadlock guards against a single-connection pool deadlock.
// With SetMaxOpenConns(1), calling raiseAlert (which issues its own queries)
// while an outer rows cursor is still open wedges the pool forever — the
// follow-up query can never acquire the sole connection. We seed a certificate
// expiring inside the 30-day window (the exact path that used to hold the cursor
// open across raiseAlert) and assert evaluation completes and the connection is
// released for a subsequent query.
func TestEvaluateAlertsNoDeadlock(t *testing.T) {
	store, err := db.Open(filepath.Join(t.TempDir(), "sim.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	soon := time.Now().Add(48 * time.Hour).Unix()
	if _, err := store.Exec(`INSERT INTO certificates(id,name,kind,subject,fingerprint,status,not_after,created_at)
		VALUES(?,?,?,?,?,?,?,?)`,
		"crt_test", "expiring-client", "client", "CN=expiring", "ab:cd:ef", "valid", soon, time.Now().Unix()); err != nil {
		t.Fatalf("seed cert: %v", err)
	}

	e := New(store.DB, ws.NewHub(true))

	done := make(chan struct{})
	go func() {
		e.evaluateAlerts()
		// Reaching a follow-up query proves the sole connection was returned.
		var n int
		_ = store.QueryRow(`SELECT COUNT(*) FROM alerts WHERE status='open' AND title='Certificate expiring'`).Scan(&n)
		if n != 1 {
			t.Errorf("expected 1 open certificate alert, got %d", n)
		}
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("evaluateAlerts deadlocked: single-connection cursor reentrancy regressed")
	}
}
