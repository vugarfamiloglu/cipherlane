// Package api wires the HTTP surface: a JSON REST API under /api, a WebSocket
// telemetry endpoint at /ws, and a static single-page-app fallback.
package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"cipherlane/internal/auth"
	"cipherlane/internal/config"
	"cipherlane/internal/db"
	"cipherlane/internal/sim"
	"cipherlane/internal/vault"
	"cipherlane/internal/ws"
)

// Server bundles the dependencies every handler needs.
type Server struct {
	Cfg      config.Config
	DB       *db.DB
	Sim      *sim.Engine
	Hub      *ws.Hub
	Secret string // session HMAC secret (base64)
	Vault  *vault.Vault
}

// Handler builds the root http.Handler.
func (s *Server) Handler() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	if s.Cfg.Dev {
		r.Use(devCORS)
	}

	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/login", s.login)
		r.Post("/auth/logout", s.logout)
		r.Get("/auth/me", s.me)

		// Gateway agents authenticate with a bearer token, not a session cookie.
		r.Get("/agents/config", s.agentConfig)
		r.Post("/agents/report", s.agentReport)

		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Get("/overview", s.overview)
			r.Get("/metrics", s.metrics)
			r.Get("/sites", s.listSites)
			r.Get("/sites/{id}", s.getSite)
			r.Get("/tunnels", s.listTunnels)
			r.Get("/tunnels/{id}", s.getTunnel)
			r.Get("/users", s.listUsers)
			r.Get("/users/{id}", s.getUser)
			r.Get("/sessions", s.listSessions)
			r.Get("/resources", s.listResources)
			r.Get("/policies", s.listPolicies)
			r.Get("/gateways", s.listGateways)
			r.Get("/cloud", s.listCloud)
			r.Get("/certificates", s.listCertificates)
			r.Get("/keys", s.listKeys)
			r.Get("/alerts", s.listAlerts)
			r.Get("/audit", s.listAudit)

			r.Post("/sites", s.createSite)
			r.Post("/tunnels", s.createTunnel)
			r.Post("/policies", s.createPolicy)

			r.Get("/auth/mfa", s.mfaStatus)
			r.Post("/auth/mfa/setup", s.mfaSetup)
			r.Post("/auth/mfa/activate", s.mfaActivate)
			r.Post("/auth/mfa/disable", s.mfaDisable)
			r.Get("/agent/token", s.agentTokenInfo)

			r.Post("/auth/passcode", s.changePasscode)
			r.Get("/backup", s.backup)
			r.Post("/reset", s.resetEstate)
		})
	})

	r.Get("/ws", func(w http.ResponseWriter, req *http.Request) {
		tok, err := auth.TokenFromRequest(req)
		if err != nil || !auth.ValidToken(s.Secret, tok) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		s.Hub.ServeWS(w, req)
	})

	r.NotFound(s.serveSPA)
	return r
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tok, err := auth.TokenFromRequest(r)
		if err != nil || !auth.ValidToken(s.Secret, tok) {
			writeErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// devCORS relaxes CORS for the Vite dev server on localhost only.
func devCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:") {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// serveSPA serves built assets and falls back to index.html for client routes.
func (s *Server) serveSPA(w http.ResponseWriter, r *http.Request) {
	dir := s.Cfg.WebDir
	clean := filepath.Clean("/" + strings.TrimPrefix(r.URL.Path, "/"))
	p := filepath.Join(dir, clean)
	if rel, err := filepath.Rel(dir, p); err != nil || strings.HasPrefix(rel, "..") {
		http.NotFound(w, r)
		return
	}
	if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
		http.ServeFile(w, r, p)
		return
	}
	if _, err := os.Stat(filepath.Join(dir, "index.html")); err == nil {
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("Cipherlane control plane API is running.\n" +
		"Frontend not built — run the Vite dev server (npm run dev) or `npm run build`."))
}
