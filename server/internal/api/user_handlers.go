package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"cipherlane/internal/db"
	"cipherlane/internal/wg"
)

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func (s *Server) createUser(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Name, Email, Username, Role, Group, TunnelMode, CorporateIp string
		MfaEnabled                                                  bool
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(b.Name) == "" || strings.TrimSpace(b.Username) == "" {
		writeErr(w, http.StatusBadRequest, "name and username are required")
		return
	}
	id, now := db.NewID("usr"), time.Now().Unix()
	_, err := s.DB.Exec(`INSERT INTO users(id,name,email,username,role,group_name,status,tunnel_mode,corporate_ip,mfa_enabled,created_at,updated_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, id, b.Name, b.Email, b.Username, def(b.Role, "member"), b.Group, "active",
		def(b.TunnelMode, "split"), b.CorporateIp, boolToInt(b.MfaEnabled), now, now)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "user.create", b.Name)
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (s *Server) updateUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var b struct {
		Name, Email, Username, Role, Group, Status, TunnelMode, CorporateIp string
		MfaEnabled                                                          bool
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	_, err := s.DB.Exec(`UPDATE users SET name=?, email=?, username=?, role=?, group_name=?, status=?, tunnel_mode=?, corporate_ip=?, mfa_enabled=?, updated_at=? WHERE id=?`,
		b.Name, b.Email, b.Username, def(b.Role, "member"), b.Group, def(b.Status, "active"),
		def(b.TunnelMode, "split"), b.CorporateIp, boolToInt(b.MfaEnabled), time.Now().Unix(), id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "user.update", b.Name)
	writeJSON(w, http.StatusOK, map[string]any{"updated": true})
}

func (s *Server) deleteUser(w http.ResponseWriter, r *http.Request) {
	s.deleteEntity(w, r, "users", "user.delete")
	s.Sim.Reload() // cascaded sessions/devices
}

func (s *Server) suspendUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var cur string
	if s.DB.QueryRow(`SELECT status FROM users WHERE id=?`, id).Scan(&cur) != nil {
		writeErr(w, http.StatusNotFound, "user not found")
		return
	}
	next := "active"
	if cur == "active" {
		next = "suspended"
	}
	_, _ = s.DB.Exec(`UPDATE users SET status=?, updated_at=? WHERE id=?`, next, time.Now().Unix(), id)
	s.audit(r, "user.suspend", id)
	writeJSON(w, http.StatusOK, map[string]any{"status": next})
}

// enrollDevice issues a real WireGuard key pair and returns a client config + QR text.
func (s *Server) enrollDevice(w http.ResponseWriter, r *http.Request) {
	uid := chi.URLParam(r, "id")
	var b struct{ Name, Platform string }
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(b.Name) == "" {
		writeErr(w, http.StatusBadRequest, "device name is required")
		return
	}
	var corpIP, uname string
	err := s.DB.QueryRow(`SELECT corporate_ip, username FROM users WHERE id=?`, uid).Scan(&corpIP, &uname)
	if err == sql.ErrNoRows {
		writeErr(w, http.StatusNotFound, "user not found")
		return
	}
	priv, pub, err := wg.GenerateKeypair()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "keygen failed")
		return
	}
	did, now := db.NewID("dev"), time.Now().Unix()
	if _, err := s.DB.Exec(`INSERT INTO devices(id,user_id,name,platform,public_key,last_handshake,status,created_at)
		VALUES(?,?,?,?,?,?,?,?)`, did, uid, b.Name, def(b.Platform, "windows"), pub, now, "active", now); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	var serverPub string
	_ = s.DB.QueryRow(`SELECT public_material FROM keys WHERE kind='wireguard' AND public_material != '' LIMIT 1`).Scan(&serverPub)
	if serverPub == "" {
		serverPub = "<hq-gateway-public-key>"
	}
	cfg := wg.ClientConfig(priv, def(corpIP, "10.10.200.60"), serverPub, "vpn-hq.cipherlane.az:51820",
		"10.10.0.0/16, 10.20.0.0/16, 10.40.0.0/16", "10.10.1.2")

	s.audit(r, "user.enroll_device", b.Name)
	writeJSON(w, http.StatusCreated, map[string]any{
		"device":    map[string]any{"id": did, "name": b.Name, "platform": def(b.Platform, "windows"), "publicKey": pub},
		"config":    cfg,
		"publicKey": pub,
	})
}

func (s *Server) deleteDevice(w http.ResponseWriter, r *http.Request) {
	s.deleteEntity(w, r, "devices", "device.delete")
}
