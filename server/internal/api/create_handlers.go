package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"cipherlane/internal/db"
)

// audit records a control-plane mutation with the caller's IP.
func (s *Server) audit(r *http.Request, action, target string) {
	_, _ = s.DB.Exec(`INSERT INTO audit_events(id, actor, action, target, ip, created_at) VALUES(?,?,?,?,?,?)`,
		db.NewID("aud"), "operator", action, target, r.RemoteAddr, time.Now().Unix())
}

func (s *Server) createSite(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Name, Code, Kind, Location, SubnetCidr string
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	b.Name, b.Code = strings.TrimSpace(b.Name), strings.TrimSpace(b.Code)
	if b.Name == "" || b.Code == "" {
		writeErr(w, http.StatusBadRequest, "name and code are required")
		return
	}
	kind := b.Kind
	if kind == "" {
		kind = "branch"
	}
	id, now := db.NewID("site"), time.Now().Unix()
	if _, err := s.DB.Exec(`INSERT INTO sites(id,name,code,kind,location,subnet_cidr,status,created_at,updated_at)
		VALUES(?,?,?,?,?,?,?,?,?)`, id, b.Name, b.Code, kind, b.Location, b.SubnetCidr, "online", now, now); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "site.create", b.Name)
	writeJSON(w, http.StatusCreated, map[string]any{
		"id": id, "name": b.Name, "code": b.Code, "kind": kind,
		"location": b.Location, "subnetCidr": b.SubnetCidr, "status": "online",
		"createdAt": now, "updatedAt": now, "tunnelCount": 0,
	})
}

func (s *Server) createTunnel(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Name, ASiteId, BSiteId, Protocol, Cipher, AuthMethod, Routing string
		AlwaysOn                                                      *bool
		Mtu                                                           int
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	b.Name = strings.TrimSpace(b.Name)
	if b.Name == "" || b.ASiteId == "" || b.BSiteId == "" {
		writeErr(w, http.StatusBadRequest, "name and both endpoints are required")
		return
	}
	if b.ASiteId == b.BSiteId {
		writeErr(w, http.StatusBadRequest, "endpoints must be different sites")
		return
	}
	if !s.siteExists(b.ASiteId) || !s.siteExists(b.BSiteId) {
		writeErr(w, http.StatusBadRequest, "unknown site")
		return
	}
	proto := b.Protocol
	if proto != "ipsec" {
		proto = "wireguard"
	}
	cipher := b.Cipher
	if cipher == "" {
		cipher = map[string]string{"wireguard": "chacha20-poly1305", "ipsec": "aes-256-gcm"}[proto]
	}
	routing := b.Routing
	if routing == "" {
		routing = "static"
	}
	auth := b.AuthMethod
	if auth == "" {
		auth = "psk"
	}
	mtu := b.Mtu
	if mtu == 0 {
		mtu = 1420
	}
	always := 1
	if b.AlwaysOn != nil && !*b.AlwaysOn {
		always = 0
	}
	id, now := db.NewID("tnl"), time.Now().Unix()
	if _, err := s.DB.Exec(`INSERT INTO tunnels(id,name,a_site_id,b_site_id,protocol,cipher,auth_method,routing,always_on,status,mtu,created_at,updated_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, b.Name, b.ASiteId, b.BSiteId, proto, cipher, auth, routing, always, "up", mtu, now, now); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.Sim.AddTunnel(id, "up")
	s.audit(r, "tunnel.create", b.Name)
	tuns := s.tunnelsWhere("WHERE t.id = ?", id)
	if len(tuns) == 0 {
		writeJSON(w, http.StatusCreated, map[string]any{"id": id})
		return
	}
	writeJSON(w, http.StatusCreated, tuns[0])
}

func (s *Server) createPolicy(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Name, Group, ResourceId, Action string
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	b.Name = strings.TrimSpace(b.Name)
	if b.Name == "" || b.Group == "" || b.ResourceId == "" {
		writeErr(w, http.StatusBadRequest, "name, group, and resource are required")
		return
	}
	action := b.Action
	if action != "deny" {
		action = "allow"
	}
	id, now := db.NewID("pol"), time.Now().Unix()
	if _, err := s.DB.Exec(`INSERT INTO policies(id,name,group_name,resource_id,action,created_at) VALUES(?,?,?,?,?,?)`,
		id, b.Name, b.Group, b.ResourceId, action, now); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "policy.create", b.Name)
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (s *Server) siteExists(id string) bool {
	var n int
	_ = s.DB.QueryRow(`SELECT COUNT(*) FROM sites WHERE id=?`, id).Scan(&n)
	return n > 0
}
