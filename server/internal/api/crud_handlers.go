package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"cipherlane/internal/db"
	"cipherlane/internal/wg"
)

// deleteEntity removes a row by id from a fixed table name (never user input).
func (s *Server) deleteEntity(w http.ResponseWriter, r *http.Request, table, action string) {
	id := chi.URLParam(r, "id")
	res, err := s.DB.Exec("DELETE FROM "+table+" WHERE id = ?", id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	s.audit(r, action, id)
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}

func def(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}

// ---- Sites -------------------------------------------------------------------

func (s *Server) updateSite(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var b struct{ Name, Code, Kind, Location, SubnetCidr, Status string }
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(b.Name) == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	_, err := s.DB.Exec(`UPDATE sites SET name=?, code=?, kind=?, location=?, subnet_cidr=?, status=?, updated_at=? WHERE id=?`,
		b.Name, b.Code, def(b.Kind, "branch"), b.Location, b.SubnetCidr, def(b.Status, "online"), time.Now().Unix(), id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "site.update", b.Name)
	writeJSON(w, http.StatusOK, map[string]any{"updated": true})
}

func (s *Server) deleteSite(w http.ResponseWriter, r *http.Request) {
	s.deleteEntity(w, r, "sites", "site.delete")
	s.Sim.Reload() // cascaded tunnels/gateways
}

// ---- Tunnels -----------------------------------------------------------------

func (s *Server) updateTunnel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var b struct {
		Name, Protocol, Cipher, AuthMethod, Routing, Status string
		AlwaysOn                                            *bool
		Mtu                                                 int
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	always := 1
	if b.AlwaysOn != nil && !*b.AlwaysOn {
		always = 0
	}
	mtu := b.Mtu
	if mtu == 0 {
		mtu = 1420
	}
	status := def(b.Status, "up")
	_, err := s.DB.Exec(`UPDATE tunnels SET name=?, protocol=?, cipher=?, auth_method=?, routing=?, always_on=?, status=?, mtu=?, updated_at=? WHERE id=?`,
		b.Name, def(b.Protocol, "wireguard"), def(b.Cipher, "chacha20-poly1305"), def(b.AuthMethod, "psk"),
		def(b.Routing, "static"), always, status, mtu, time.Now().Unix(), id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.Sim.SetTunnelStatus(id, status)
	s.audit(r, "tunnel.update", b.Name)
	writeJSON(w, http.StatusOK, map[string]any{"updated": true})
}

func (s *Server) deleteTunnel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s.deleteEntity(w, r, "tunnels", "tunnel.delete")
	s.Sim.RemoveTunnel(id)
}

func (s *Server) toggleTunnel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var cur string
	if s.DB.QueryRow(`SELECT status FROM tunnels WHERE id=?`, id).Scan(&cur) != nil {
		writeErr(w, http.StatusNotFound, "tunnel not found")
		return
	}
	next := "up"
	if cur != "down" {
		next = "down"
	}
	_, _ = s.DB.Exec(`UPDATE tunnels SET status=?, updated_at=? WHERE id=?`, next, time.Now().Unix(), id)
	s.Sim.SetTunnelStatus(id, next)
	s.audit(r, "tunnel.toggle", id)
	writeJSON(w, http.StatusOK, map[string]any{"status": next})
}

// ---- Resources ---------------------------------------------------------------

func (s *Server) createResource(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Name, Kind, Host, SiteId string
		Port                     int
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(b.Name) == "" || strings.TrimSpace(b.Kind) == "" {
		writeErr(w, http.StatusBadRequest, "name and kind are required")
		return
	}
	id := db.NewID("res")
	if _, err := s.DB.Exec(`INSERT INTO resources(id,name,kind,host,port,site_id,created_at) VALUES(?,?,?,?,?,?,?)`,
		id, b.Name, b.Kind, b.Host, b.Port, b.SiteId, time.Now().Unix()); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "resource.create", b.Name)
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (s *Server) updateResource(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var b struct {
		Name, Kind, Host, SiteId string
		Port                     int
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	_, err := s.DB.Exec(`UPDATE resources SET name=?, kind=?, host=?, port=?, site_id=? WHERE id=?`,
		b.Name, b.Kind, b.Host, b.Port, b.SiteId, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "resource.update", b.Name)
	writeJSON(w, http.StatusOK, map[string]any{"updated": true})
}

func (s *Server) deleteResource(w http.ResponseWriter, r *http.Request) {
	s.deleteEntity(w, r, "resources", "resource.delete")
}

// ---- Policies ----------------------------------------------------------------

func (s *Server) updatePolicy(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var b struct{ Name, Group, ResourceId, Action string }
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	action := "allow"
	if b.Action == "deny" {
		action = "deny"
	}
	_, err := s.DB.Exec(`UPDATE policies SET name=?, group_name=?, resource_id=?, action=? WHERE id=?`,
		b.Name, b.Group, b.ResourceId, action, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "policy.update", b.Name)
	writeJSON(w, http.StatusOK, map[string]any{"updated": true})
}

func (s *Server) deletePolicy(w http.ResponseWriter, r *http.Request) {
	s.deleteEntity(w, r, "policies", "policy.delete")
}

// ---- Gateways ----------------------------------------------------------------

func (s *Server) createGateway(w http.ResponseWriter, r *http.Request) {
	var b struct{ SiteId, Name, Endpoint, WanIp, Protocol, Version string }
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(b.Name) == "" || strings.TrimSpace(b.SiteId) == "" {
		writeErr(w, http.StatusBadRequest, "name and site are required")
		return
	}
	id, now := db.NewID("gw"), time.Now().Unix()
	if _, err := s.DB.Exec(`INSERT INTO gateways(id,site_id,name,endpoint,wan_ip,protocol,version,status,last_seen,created_at,updated_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?)`, id, b.SiteId, b.Name, b.Endpoint, b.WanIp, def(b.Protocol, "wireguard"), b.Version, "online", now, now, now); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "gateway.create", b.Name)
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (s *Server) updateGateway(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var b struct{ SiteId, Name, Endpoint, WanIp, Protocol, Version, Status string }
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	_, err := s.DB.Exec(`UPDATE gateways SET site_id=?, name=?, endpoint=?, wan_ip=?, protocol=?, version=?, status=?, updated_at=? WHERE id=?`,
		b.SiteId, b.Name, b.Endpoint, b.WanIp, def(b.Protocol, "wireguard"), b.Version, def(b.Status, "online"), time.Now().Unix(), id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "gateway.update", b.Name)
	writeJSON(w, http.StatusOK, map[string]any{"updated": true})
}

func (s *Server) deleteGateway(w http.ResponseWriter, r *http.Request) {
	s.deleteEntity(w, r, "gateways", "gateway.delete")
}

// rotateGateway generates a fresh WireGuard key pair and stores it sealed.
func (s *Server) rotateGateway(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var name string
	if s.DB.QueryRow(`SELECT name FROM gateways WHERE id=?`, id).Scan(&name) != nil {
		writeErr(w, http.StatusNotFound, "gateway not found")
		return
	}
	priv, pub, err := wg.GenerateKeypair()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "keygen failed")
		return
	}
	sealed, err := s.Vault.Encrypt(priv)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "vault error")
		return
	}
	_, _ = s.DB.Exec(`INSERT INTO keys(id,name,kind,public_material,secret_encrypted,created_at) VALUES(?,?,?,?,?,?)`,
		db.NewID("key"), name+" WireGuard", "wireguard", pub, sealed, time.Now().Unix())
	_, _ = s.DB.Exec(`UPDATE gateways SET last_seen=?, updated_at=? WHERE id=?`, time.Now().Unix(), time.Now().Unix(), id)
	s.audit(r, "gateway.rotate_key", name)
	writeJSON(w, http.StatusOK, map[string]any{"publicKey": pub})
}
