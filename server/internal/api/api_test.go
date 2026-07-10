package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"cipherlane/internal/auth"
	"cipherlane/internal/config"
	"cipherlane/internal/db"
	"cipherlane/internal/sim"
	"cipherlane/internal/vault"
	"cipherlane/internal/ws"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	dir := t.TempDir()
	store, err := db.Open(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Seed(store); err != nil {
		t.Fatal(err)
	}
	vlt, err := vault.Open(filepath.Join(dir, ".vault-key"))
	if err != nil {
		t.Fatal(err)
	}
	secret, _ := auth.NewSecret()
	pass, _ := auth.HashPasscode("cipherlane")
	_ = store.SetSetting("agent_token", "test-token")
	t.Cleanup(func() { _ = store.Close() })
	hub := ws.NewHub(true)
	return &Server{
		Cfg: config.Config{Dev: true}, DB: store, Sim: sim.New(store.DB, hub),
		Hub: hub, Secret: secret, Passcode: pass, Vault: vlt,
	}
}

func loginCookies(t *testing.T, h http.Handler) []*http.Cookie {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"passcode": "cipherlane"})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", rr.Code, rr.Body)
	}
	return rr.Result().Cookies()
}

func TestOverviewRequiresAuth(t *testing.T) {
	h := newTestServer(t).Handler()
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/overview", nil))
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rr.Code)
	}
}

func TestBadPasscode(t *testing.T) {
	h := newTestServer(t).Handler()
	body, _ := json.Marshal(map[string]string{"passcode": "nope"})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body)))
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rr.Code)
	}
}

func TestLoginAndOverview(t *testing.T) {
	h := newTestServer(t).Handler()
	cookies := loginCookies(t, h)
	if len(cookies) == 0 {
		t.Fatal("no session cookie set")
	}
	req := httptest.NewRequest(http.MethodGet, "/api/overview", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("overview want 200, got %d", rr.Code)
	}
	var env struct {
		OK   bool
		Data struct {
			Counts map[string]int `json:"counts"`
		}
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &env); err != nil {
		t.Fatal(err)
	}
	if !env.OK || env.Data.Counts["sites"] == 0 {
		t.Fatalf("unexpected overview payload: %s", rr.Body)
	}
}

func TestCreateTunnel(t *testing.T) {
	s := newTestServer(t)
	h := s.Handler()
	cookies := loginCookies(t, h)
	body, _ := json.Marshal(map[string]any{
		"name": "Test Link", "aSiteId": "site_hq", "bSiteId": "site_gnj", "protocol": "wireguard",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/tunnels", bytes.NewReader(body))
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("create tunnel want 201, got %d: %s", rr.Code, rr.Body)
	}
}

func TestAgentReportOverridesTelemetry(t *testing.T) {
	s := newTestServer(t)
	h := s.Handler()
	body, _ := json.Marshal(map[string]any{
		"gatewayId": "gw_hq",
		"peers":     []map[string]any{{"tunnelId": "tnl_hq_gnj", "rxMbps": 123.4, "txMbps": 50, "handshakeAgeS": 5}},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/agents/report", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer test-token")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("agent report want 200, got %d: %s", rr.Code, rr.Body)
	}
	live, ok := s.Sim.TunnelLive("tnl_hq_gnj")
	if !ok || live.RxMbps != 123.4 {
		t.Fatalf("report not applied to telemetry: %+v", live)
	}
}

func TestAgentReportRejectsBadToken(t *testing.T) {
	h := newTestServer(t).Handler()
	req := httptest.NewRequest(http.MethodPost, "/api/agents/report", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Authorization", "Bearer wrong")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rr.Code)
	}
}
