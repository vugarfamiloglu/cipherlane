package api

import (
	"encoding/json"
	"io"
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

// restore imports domain data from an uploaded SQLite snapshot (settings and the
// vault key are preserved so the current session and secrets keep working).
func (s *Server) restore(w http.ResponseWriter, r *http.Request) {
	tmp := filepath.Join(s.Cfg.DataDir, "restore-"+strconv.FormatInt(time.Now().UnixNano(), 10)+".db")
	f, err := os.Create(tmp)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if _, err := io.Copy(f, http.MaxBytesReader(w, r.Body, 64<<20)); err != nil {
		f.Close()
		os.Remove(tmp)
		writeErr(w, http.StatusBadRequest, "upload failed")
		return
	}
	f.Close()
	defer os.Remove(tmp)

	head := make([]byte, 16)
	if rf, err := os.Open(tmp); err == nil {
		_, _ = rf.Read(head)
		rf.Close()
	}
	if !strings.HasPrefix(string(head), "SQLite format 3") {
		writeErr(w, http.StatusBadRequest, "not a valid Cipherlane backup file")
		return
	}

	escaped := strings.ReplaceAll(tmp, "'", "''")
	if _, err := s.DB.Exec("ATTACH DATABASE '" + escaped + "' AS bak"); err != nil {
		writeErr(w, http.StatusInternalServerError, "attach failed: "+err.Error())
		return
	}
	defer func() { _, _ = s.DB.Exec("DETACH DATABASE bak") }()

	del := []string{"routes", "sessions", "devices", "gateways", "cloud_connectors", "tunnels", "resources", "policies", "certificates", "keys", "alerts", "audit_events", "operators", "users", "sites"}
	ins := []string{"sites", "users", "gateways", "tunnels", "routes", "cloud_connectors", "devices", "sessions", "resources", "policies", "certificates", "keys", "alerts", "audit_events", "operators"}

	tx, err := s.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	fail := func(e error) {
		_ = tx.Rollback()
		writeErr(w, http.StatusInternalServerError, "restore failed: "+e.Error())
	}
	for _, t := range del {
		if _, err := tx.Exec("DELETE FROM main." + t); err != nil {
			fail(err)
			return
		}
	}
	for _, t := range ins {
		if _, err := tx.Exec("INSERT INTO main." + t + " SELECT * FROM bak." + t); err != nil {
			fail(err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		fail(err)
		return
	}
	s.Sim.Reload()
	s.audit(r, "estate.restore", "snapshot")
	writeJSON(w, http.StatusOK, map[string]any{"restored": true})
}

func (s *Server) getWebhook(w http.ResponseWriter, r *http.Request) {
	url, _ := s.DB.GetSetting("webhook_url")
	writeJSON(w, http.StatusOK, map[string]any{"url": url})
}

func (s *Server) setWebhook(w http.ResponseWriter, r *http.Request) {
	var b struct{ Url string }
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	_ = s.DB.SetSetting("webhook_url", strings.TrimSpace(b.Url))
	s.audit(r, "webhook.update", "")
	writeJSON(w, http.StatusOK, map[string]any{"url": strings.TrimSpace(b.Url)})
}
