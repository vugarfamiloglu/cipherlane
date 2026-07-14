package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"cipherlane/internal/auth"
	"cipherlane/internal/db"
)

// changePasscode verifies the current passcode and stores a new bcrypt hash.
func (s *Server) changePasscode(w http.ResponseWriter, r *http.Request) {
	var b struct{ Current, Next string }
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	cur, _ := s.DB.GetSetting("passcode_hash")
	if !auth.VerifyPasscode(cur, strings.TrimSpace(b.Current)) {
		writeErr(w, http.StatusUnauthorized, "current passcode is incorrect")
		return
	}
	next := strings.TrimSpace(b.Next)
	if len(next) < 6 {
		writeErr(w, http.StatusBadRequest, "new passcode must be at least 6 characters")
		return
	}
	hash, err := auth.HashPasscode(next)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not hash passcode")
		return
	}
	if err := s.DB.SetSetting("passcode_hash", hash); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "passcode.change", "operator")
	writeJSON(w, http.StatusOK, map[string]any{"changed": true})
}

// backup streams a clean SQLite snapshot (VACUUM INTO) as a download.
func (s *Server) backup(w http.ResponseWriter, r *http.Request) {
	tmp := filepath.Join(s.Cfg.DataDir, "backup-"+strconv.FormatInt(time.Now().UnixNano(), 10)+".db")
	escaped := strings.ReplaceAll(tmp, "'", "''")
	if _, err := s.DB.Exec("VACUUM INTO '" + escaped + "'"); err != nil {
		writeErr(w, http.StatusInternalServerError, "snapshot failed: "+err.Error())
		return
	}
	defer os.Remove(tmp)
	data, err := os.ReadFile(tmp)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	name := "cipherlane-backup-" + time.Now().UTC().Format("20060102-150405") + ".db"
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	_, _ = w.Write(data)
	s.audit(r, "estate.backup", name)
}

// resetEstate wipes domain data, reseeds the demo estate, and reloads telemetry.
func (s *Server) resetEstate(w http.ResponseWriter, r *http.Request) {
	tables := []string{
		"routes", "sessions", "devices", "gateways", "cloud_connectors", "tunnels",
		"resources", "policies", "certificates", "keys", "alerts", "audit_events", "users", "sites",
	}
	tx, err := s.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, t := range tables {
		if _, err := tx.Exec("DELETE FROM " + t); err != nil {
			_ = tx.Rollback()
			writeErr(w, http.StatusInternalServerError, "reset failed: "+err.Error())
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := db.Seed(s.DB); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.Sim.Reload()
	s.audit(r, "estate.reset", "all")
	writeJSON(w, http.StatusOK, map[string]any{"reset": true})
}
