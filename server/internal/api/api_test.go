package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
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
	_ = store.SetSetting("passcode_hash", pass)
	t.Cleanup(func() { _ = store.Close() })
	hub := ws.NewHub(true)
	return &Server{
		Cfg: config.Config{Dev: true}, DB: store, Sim: sim.New(store.DB, hub),
		Hub: hub, Secret: secret, Vault: vlt,
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

func TestChangePasscode(t *testing.T) {
	s := newTestServer(t)
	h := s.Handler()
	cookies := loginCookies(t, h)
	body, _ := json.Marshal(map[string]string{"current": "cipherlane", "next": "newsecret"})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/passcode", bytes.NewReader(body))
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("change passcode want 200, got %d: %s", rr.Code, rr.Body)
	}

	login := func(pc string) int {
		b, _ := json.Marshal(map[string]string{"passcode": pc})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(b)))
		return w.Code
	}
	if login("cipherlane") == http.StatusOK {
		t.Fatal("old passcode still works after change")
	}
	if login("newsecret") != http.StatusOK {
		t.Fatal("new passcode does not work after change")
	}
}

func TestResetEstate(t *testing.T) {
	s := newTestServer(t)
	h := s.Handler()
	cookies := loginCookies(t, h)
	req := httptest.NewRequest(http.MethodPost, "/api/reset", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("reset want 200, got %d: %s", rr.Code, rr.Body)
	}
	var n int
	if err := s.DB.QueryRow("SELECT COUNT(*) FROM sites").Scan(&n); err != nil || n == 0 {
		t.Fatalf("sites not reseeded after reset (n=%d, err=%v)", n, err)
	}
}

func authDo(h http.Handler, cookies []*http.Cookie, method, path string, body any) *httptest.ResponseRecorder {
	var rdr io.Reader
	if body != nil {
		bs, _ := json.Marshal(body)
		rdr = bytes.NewReader(bs)
	}
	req := httptest.NewRequest(method, path, rdr)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

func dataID(rr *httptest.ResponseRecorder) string {
	var out struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &out)
	return out.Data.ID
}

func TestUserLifecycleAndEnrollment(t *testing.T) {
	h := newTestServer(t).Handler()
	cookies := loginCookies(t, h)

	rr := authDo(h, cookies, http.MethodPost, "/api/users", map[string]any{"name": "Test User", "username": "testu"})
	if rr.Code != http.StatusCreated {
		t.Fatalf("create user: %d %s", rr.Code, rr.Body)
	}
	uid := dataID(rr)
	if uid == "" {
		t.Fatal("no user id returned")
	}

	rr = authDo(h, cookies, http.MethodPost, "/api/users/"+uid+"/devices", map[string]any{"name": "laptop", "platform": "linux"})
	if rr.Code != http.StatusCreated {
		t.Fatalf("enroll device: %d %s", rr.Code, rr.Body)
	}
	var dev struct {
		Data struct {
			Config string `json:"config"`
		} `json:"data"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &dev)
	if !strings.Contains(dev.Data.Config, "[Interface]") || !strings.Contains(dev.Data.Config, "[Peer]") {
		t.Fatalf("device config is not a WireGuard config: %q", dev.Data.Config)
	}

	if rr = authDo(h, cookies, http.MethodDelete, "/api/users/"+uid, nil); rr.Code != http.StatusOK {
		t.Fatalf("delete user: %d %s", rr.Code, rr.Body)
	}
}

func TestVaultKeyGenerateAndReveal(t *testing.T) {
	h := newTestServer(t).Handler()
	cookies := loginCookies(t, h)

	rr := authDo(h, cookies, http.MethodPost, "/api/keys", map[string]any{"name": "test key", "kind": "wireguard"})
	if rr.Code != http.StatusCreated {
		t.Fatalf("generate key: %d %s", rr.Code, rr.Body)
	}
	var k struct {
		Data struct {
			ID             string `json:"id"`
			PublicMaterial string `json:"publicMaterial"`
		} `json:"data"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &k)
	if k.Data.PublicMaterial == "" {
		t.Fatal("generated WireGuard key has no public material")
	}

	rr = authDo(h, cookies, http.MethodPost, "/api/keys/"+k.Data.ID+"/reveal", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("reveal key: %d %s", rr.Code, rr.Body)
	}
	var rev struct {
		Data struct {
			Secret string `json:"secret"`
		} `json:"data"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &rev)
	if rev.Data.Secret == "" {
		t.Fatal("revealed secret is empty")
	}
}

func TestToggleTunnel(t *testing.T) {
	h := newTestServer(t).Handler()
	cookies := loginCookies(t, h)
	rr := authDo(h, cookies, http.MethodPost, "/api/tunnels/tnl_hq_gnj/toggle", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("toggle: %d %s", rr.Code, rr.Body)
	}
	var out struct {
		Data struct {
			Status string `json:"status"`
		} `json:"data"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &out)
	if out.Data.Status != "down" {
		t.Fatalf("expected status down after toggling an up tunnel, got %q", out.Data.Status)
	}
}

func TestIssueCertificate(t *testing.T) {
	h := newTestServer(t).Handler()
	cookies := loginCookies(t, h)
	rr := authDo(h, cookies, http.MethodPost, "/api/certificates", map[string]any{"name": "client-x", "kind": "client", "days": 30})
	if rr.Code != http.StatusCreated {
		t.Fatalf("issue cert: %d %s", rr.Code, rr.Body)
	}
	var c struct {
		Data struct {
			Fingerprint string `json:"fingerprint"`
			CertPem     string `json:"certPem"`
		} `json:"data"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &c)
	if !strings.Contains(c.Data.CertPem, "BEGIN CERTIFICATE") || c.Data.Fingerprint == "" {
		t.Fatalf("issued cert invalid: %+v", c.Data)
	}
}
