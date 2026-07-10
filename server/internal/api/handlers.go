package api

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"

	"cipherlane/internal/models"
)

type gatewayOut struct {
	models.Gateway
	SiteName string `json:"siteName"`
}

type keyOut struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Kind           string `json:"kind"`
	PublicMaterial string `json:"publicMaterial"`
	Sealed         bool   `json:"sealed"`
	CreatedAt      int64  `json:"createdAt"`
}

// ---- Overview ----------------------------------------------------------------

func (s *Server) overview(w http.ResponseWriter, r *http.Request) {
	count := func(q string) int {
		var n int
		_ = s.DB.QueryRow(q).Scan(&n)
		return n
	}
	counts := map[string]int{
		"sites":          count("SELECT COUNT(*) FROM sites"),
		"sitesOnline":    count("SELECT COUNT(*) FROM sites WHERE status='online'"),
		"tunnels":        count("SELECT COUNT(*) FROM tunnels"),
		"tunnelsUp":      count("SELECT COUNT(*) FROM tunnels WHERE status='up'"),
		"users":          count("SELECT COUNT(*) FROM users"),
		"usersActive":    count("SELECT COUNT(*) FROM users WHERE status='active'"),
		"gateways":       count("SELECT COUNT(*) FROM gateways"),
		"gatewaysOnline": count("SELECT COUNT(*) FROM gateways WHERE status='online'"),
		"onlineSessions": count("SELECT COUNT(*) FROM sessions WHERE status='connected'"),
		"alertsOpen":     count("SELECT COUNT(*) FROM alerts WHERE status='open'"),
	}
	snap := s.Sim.Snapshot()
	writeJSON(w, http.StatusOK, map[string]any{
		"counts": counts,
		"live":   snap.Global,
		"series": snap.Series,
		"alerts": s.alertsLimited(6),
		"audit":  s.auditLimited(6),
	})
}

func (s *Server) metrics(w http.ResponseWriter, r *http.Request) {
	snap := s.Sim.Snapshot()
	writeJSON(w, http.StatusOK, map[string]any{
		"series":   snap.Series,
		"global":   snap.Global,
		"tunnels":  snap.Tunnels,
		"sessions": snap.Sessions,
	})
}

// ---- Sites -------------------------------------------------------------------

func (s *Server) listSites(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Query(`
		SELECT s.id, s.name, s.code, s.kind, s.location, s.subnet_cidr, s.status, s.created_at, s.updated_at,
		  (SELECT COUNT(*) FROM tunnels t WHERE t.a_site_id = s.id OR t.b_site_id = s.id)
		FROM sites s
		ORDER BY CASE s.kind WHEN 'hq' THEN 0 WHEN 'datacenter' THEN 1 WHEN 'branch' THEN 2 ELSE 3 END, s.name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []models.Site{}
	for rows.Next() {
		var s0 models.Site
		if err := rows.Scan(&s0.ID, &s0.Name, &s0.Code, &s0.Kind, &s0.Location, &s0.SubnetCIDR,
			&s0.Status, &s0.CreatedAt, &s0.UpdatedAt, &s0.TunnelCount); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, s0)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) getSite(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var s0 models.Site
	err := s.DB.QueryRow(`SELECT id, name, code, kind, location, subnet_cidr, status, created_at, updated_at
		FROM sites WHERE id = ?`, id).
		Scan(&s0.ID, &s0.Name, &s0.Code, &s0.Kind, &s0.Location, &s0.SubnetCIDR, &s0.Status, &s0.CreatedAt, &s0.UpdatedAt)
	if err == sql.ErrNoRows {
		writeErr(w, http.StatusNotFound, "site not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s0.Gateways = s.gatewaysForSite(id)
	resources := []models.Resource{}
	if rows, err := s.DB.Query(`SELECT id, name, kind, host, port, site_id, created_at
		FROM resources WHERE site_id = ? ORDER BY name`, id); err == nil {
		defer rows.Close()
		for rows.Next() {
			var res models.Resource
			if rows.Scan(&res.ID, &res.Name, &res.Kind, &res.Host, &res.Port, &res.SiteID, &res.CreatedAt) == nil {
				res.SiteName = s0.Name
				resources = append(resources, res)
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"site":      s0,
		"tunnels":   s.tunnelsWhere("WHERE t.a_site_id = ? OR t.b_site_id = ?", id, id),
		"resources": resources,
	})
}

func (s *Server) gatewaysForSite(siteID string) []models.Gateway {
	out := []models.Gateway{}
	rows, err := s.DB.Query(`SELECT id, site_id, name, endpoint, wan_ip, protocol, version, status, last_seen, created_at, updated_at
		FROM gateways WHERE site_id = ? ORDER BY name`, siteID)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var g models.Gateway
		if rows.Scan(&g.ID, &g.SiteID, &g.Name, &g.Endpoint, &g.WANIP, &g.Protocol, &g.Version,
			&g.Status, &g.LastSeen, &g.CreatedAt, &g.UpdatedAt) == nil {
			out = append(out, g)
		}
	}
	return out
}

// ---- Tunnels -----------------------------------------------------------------

func (s *Server) listTunnels(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.tunnelsWhere(""))
}

func (s *Server) getTunnel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tuns := s.tunnelsWhere("WHERE t.id = ?", id)
	if len(tuns) == 0 {
		writeErr(w, http.StatusNotFound, "tunnel not found")
		return
	}
	t := tuns[0]
	t.Routes = []models.Route{}
	if rows, err := s.DB.Query(`SELECT id, tunnel_id, cidr, kind FROM routes WHERE tunnel_id = ? ORDER BY cidr`, id); err == nil {
		defer rows.Close()
		for rows.Next() {
			var rt models.Route
			if rows.Scan(&rt.ID, &rt.TunnelID, &rt.CIDR, &rt.Kind) == nil {
				t.Routes = append(t.Routes, rt)
			}
		}
	}
	writeJSON(w, http.StatusOK, t)
}

func (s *Server) tunnelsWhere(cond string, args ...any) []models.Tunnel {
	out := []models.Tunnel{}
	q := `SELECT t.id, t.name, t.a_site_id, t.b_site_id, a.name, b.name, t.protocol, t.cipher,
		t.auth_method, t.routing, t.always_on, t.status, t.mtu, t.created_at, t.updated_at
		FROM tunnels t
		JOIN sites a ON a.id = t.a_site_id
		JOIN sites b ON b.id = t.b_site_id ` + cond + ` ORDER BY t.name`
	rows, err := s.DB.Query(q, args...)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var t models.Tunnel
		var always int
		if rows.Scan(&t.ID, &t.Name, &t.ASiteID, &t.BSiteID, &t.ASiteName, &t.BSiteName, &t.Protocol,
			&t.Cipher, &t.AuthMethod, &t.Routing, &always, &t.Status, &t.MTU, &t.CreatedAt, &t.UpdatedAt) == nil {
			t.AlwaysOn = always == 1
			if lv, ok := s.Sim.TunnelLive(t.ID); ok {
				live := lv
				t.Live = &live
			}
			out = append(out, t)
		}
	}
	return out
}

// ---- Users -------------------------------------------------------------------

func (s *Server) listUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Query(`SELECT id, name, email, username, role, group_name, status, tunnel_mode,
		corporate_ip, mfa_enabled, created_at, updated_at FROM users ORDER BY name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []models.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, u)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) getUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	row := s.DB.QueryRow(`SELECT id, name, email, username, role, group_name, status, tunnel_mode,
		corporate_ip, mfa_enabled, created_at, updated_at FROM users WHERE id = ?`, id)
	u, err := scanUser(row)
	if err == sql.ErrNoRows {
		writeErr(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	u.Devices = []models.Device{}
	if rows, err := s.DB.Query(`SELECT id, user_id, name, platform, public_key, last_handshake, status, created_at
		FROM devices WHERE user_id = ? ORDER BY created_at`, id); err == nil {
		defer rows.Close()
		for rows.Next() {
			var d models.Device
			if rows.Scan(&d.ID, &d.UserID, &d.Name, &d.Platform, &d.PublicKey, &d.LastHandshake, &d.Status, &d.CreatedAt) == nil {
				u.Devices = append(u.Devices, d)
			}
		}
	}
	u.Sessions = s.sessionsWhere("WHERE s.user_id = ?", id)
	writeJSON(w, http.StatusOK, u)
}

type scanner interface {
	Scan(dest ...any) error
}

func scanUser(row scanner) (models.User, error) {
	var u models.User
	var mfa int
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.Username, &u.Role, &u.Group, &u.Status,
		&u.TunnelMode, &u.CorporateIP, &mfa, &u.CreatedAt, &u.UpdatedAt)
	u.MFAEnabled = mfa == 1
	return u, err
}

// ---- Sessions ----------------------------------------------------------------

func (s *Server) listSessions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.sessionsWhere(""))
}

func (s *Server) sessionsWhere(cond string, args ...any) []models.Session {
	out := []models.Session{}
	q := `SELECT s.id, s.user_id, u.name, s.device_id, COALESCE(d.name, ''), s.client_ip, s.assigned_ip,
		s.location, s.status, s.started_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		LEFT JOIN devices d ON d.id = s.device_id ` + cond + ` ORDER BY s.started_at DESC`
	rows, err := s.DB.Query(q, args...)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var se models.Session
		if rows.Scan(&se.ID, &se.UserID, &se.UserName, &se.DeviceID, &se.DeviceName, &se.ClientIP,
			&se.AssignedIP, &se.Location, &se.Status, &se.StartedAt) == nil {
			if rx, tx, ok := s.Sim.SessionLive(se.ID); ok {
				se.RxMbps, se.TxMbps = rx, tx
			}
			out = append(out, se)
		}
	}
	return out
}

// ---- Resources & policies ----------------------------------------------------

func (s *Server) listResources(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Query(`SELECT r.id, r.name, r.kind, r.host, r.port, r.site_id, COALESCE(si.name, '')
		FROM resources r LEFT JOIN sites si ON si.id = r.site_id ORDER BY r.name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []models.Resource{}
	for rows.Next() {
		var res models.Resource
		if rows.Scan(&res.ID, &res.Name, &res.Kind, &res.Host, &res.Port, &res.SiteID, &res.SiteName) == nil {
			out = append(out, res)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) listPolicies(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Query(`SELECT p.id, p.name, p.group_name, p.resource_id, COALESCE(r.name, ''), p.action, p.created_at
		FROM policies p LEFT JOIN resources r ON r.id = p.resource_id ORDER BY p.name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []models.Policy{}
	for rows.Next() {
		var p models.Policy
		if rows.Scan(&p.ID, &p.Name, &p.Group, &p.ResourceID, &p.ResourceName, &p.Action, &p.CreatedAt) == nil {
			out = append(out, p)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// ---- Gateways & cloud --------------------------------------------------------

func (s *Server) listGateways(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Query(`SELECT g.id, g.site_id, g.name, g.endpoint, g.wan_ip, g.protocol, g.version,
		g.status, g.last_seen, g.created_at, g.updated_at, COALESCE(si.name, '')
		FROM gateways g LEFT JOIN sites si ON si.id = g.site_id ORDER BY g.name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []gatewayOut{}
	for rows.Next() {
		var g models.Gateway
		var siteName string
		if rows.Scan(&g.ID, &g.SiteID, &g.Name, &g.Endpoint, &g.WANIP, &g.Protocol, &g.Version,
			&g.Status, &g.LastSeen, &g.CreatedAt, &g.UpdatedAt, &siteName) == nil {
			out = append(out, gatewayOut{Gateway: g, SiteName: siteName})
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) listCloud(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Query(`SELECT c.id, c.site_id, COALESCE(si.name, ''), c.provider, c.region, c.vpc_id, c.status, c.created_at
		FROM cloud_connectors c LEFT JOIN sites si ON si.id = c.site_id ORDER BY c.provider`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []models.CloudConnector{}
	for rows.Next() {
		var c models.CloudConnector
		if rows.Scan(&c.ID, &c.SiteID, &c.SiteName, &c.Provider, &c.Region, &c.VPCID, &c.Status, &c.CreatedAt) == nil {
			out = append(out, c)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// ---- Vault: certificates & keys ---------------------------------------------

func (s *Server) listCertificates(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Query(`SELECT id, name, kind, subject, fingerprint, status, not_after, created_at
		FROM certificates ORDER BY CASE kind WHEN 'ca' THEN 0 WHEN 'server' THEN 1 ELSE 2 END, name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []models.Certificate{}
	for rows.Next() {
		var c models.Certificate
		if rows.Scan(&c.ID, &c.Name, &c.Kind, &c.Subject, &c.Fingerprint, &c.Status, &c.NotAfter, &c.CreatedAt) == nil {
			out = append(out, c)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) listKeys(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Query(`SELECT id, name, kind, public_material, secret_encrypted, created_at FROM keys ORDER BY name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []keyOut{}
	for rows.Next() {
		var k keyOut
		var secret string
		if rows.Scan(&k.ID, &k.Name, &k.Kind, &k.PublicMaterial, &secret, &k.CreatedAt) == nil {
			k.Sealed = secret != "" || k.Kind == "psk"
			out = append(out, k)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// ---- Alerts & audit ----------------------------------------------------------

func (s *Server) listAlerts(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.alertsLimited(200))
}

func (s *Server) alertsLimited(n int) []models.Alert {
	out := []models.Alert{}
	rows, err := s.DB.Query(`SELECT id, severity, title, detail, source, status, created_at
		FROM alerts ORDER BY status = 'resolved', created_at DESC LIMIT ?`, n)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var a models.Alert
		if rows.Scan(&a.ID, &a.Severity, &a.Title, &a.Detail, &a.Source, &a.Status, &a.CreatedAt) == nil {
			out = append(out, a)
		}
	}
	return out
}

func (s *Server) listAudit(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.auditLimited(200))
}

func (s *Server) auditLimited(n int) []models.AuditEvent {
	out := []models.AuditEvent{}
	rows, err := s.DB.Query(`SELECT id, actor, action, target, ip, created_at
		FROM audit_events ORDER BY created_at DESC LIMIT ?`, n)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var a models.AuditEvent
		if rows.Scan(&a.ID, &a.Actor, &a.Action, &a.Target, &a.IP, &a.CreatedAt) == nil {
			out = append(out, a)
		}
	}
	return out
}
