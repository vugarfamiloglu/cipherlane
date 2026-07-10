package api

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"strings"
)

// agentAuth checks the Bearer agent token (constant-time).
func (s *Server) agentAuth(r *http.Request) bool {
	tok := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	want, _ := s.DB.GetSetting("agent_token")
	return want != "" && len(tok) == len(want) && subtle.ConstantTimeCompare([]byte(tok), []byte(want)) == 1
}

// agentTokenInfo returns the enrolment token for the authenticated operator.
func (s *Server) agentTokenInfo(w http.ResponseWriter, r *http.Request) {
	tok, _ := s.DB.GetSetting("agent_token")
	writeJSON(w, http.StatusOK, map[string]any{"token": tok})
}

// agentConfig returns a deployable WireGuard config for a gateway.
func (s *Server) agentConfig(w http.ResponseWriter, r *http.Request) {
	if !s.agentAuth(r) {
		writeErr(w, http.StatusUnauthorized, "invalid agent token")
		return
	}
	gw := r.URL.Query().Get("gateway")
	if gw == "" {
		writeErr(w, http.StatusBadRequest, "gateway query param required")
		return
	}
	cfg, tunnelIDs := s.buildGatewayConfig(gw)
	writeJSON(w, http.StatusOK, map[string]any{"config": cfg, "tunnels": tunnelIDs})
}

// agentReport ingests real interface counters and overrides live telemetry.
func (s *Server) agentReport(w http.ResponseWriter, r *http.Request) {
	if !s.agentAuth(r) {
		writeErr(w, http.StatusUnauthorized, "invalid agent token")
		return
	}
	var b struct {
		GatewayID string `json:"gatewayId"`
		Peers     []struct {
			TunnelID      string  `json:"tunnelId"`
			RxMbps        float64 `json:"rxMbps"`
			TxMbps        float64 `json:"txMbps"`
			HandshakeAgeS int     `json:"handshakeAgeS"`
		} `json:"peers"`
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	for _, p := range b.Peers {
		s.Sim.ApplyReport(p.TunnelID, p.RxMbps, p.TxMbps, p.HandshakeAgeS)
	}
	writeJSON(w, http.StatusOK, map[string]any{"accepted": len(b.Peers)})
}

// buildGatewayConfig assembles a WireGuard config for every tunnel a gateway terminates.
func (s *Server) buildGatewayConfig(gwID string) (string, []string) {
	var siteID, siteName string
	_ = s.DB.QueryRow(`SELECT g.site_id, si.name FROM gateways g JOIN sites si ON si.id = g.site_id WHERE g.id = ?`, gwID).Scan(&siteID, &siteName)
	if siteID == "" {
		return "# unknown gateway: " + gwID, nil
	}
	var b strings.Builder
	b.WriteString("[Interface]\n# " + siteName + " gateway\nPrivateKey = <sealed-in-vault>\nAddress    = 10.255.0.1/24\nListenPort = 51820\n")
	ids := []string{}
	rows, err := s.DB.Query(`SELECT t.id,
		CASE WHEN t.a_site_id = ? THEN b2.name ELSE a2.name END,
		CASE WHEN t.a_site_id = ? THEN b2.subnet_cidr ELSE a2.subnet_cidr END
		FROM tunnels t
		JOIN sites a2 ON a2.id = t.a_site_id
		JOIN sites b2 ON b2.id = t.b_site_id
		WHERE (t.a_site_id = ? OR t.b_site_id = ?) AND t.protocol = 'wireguard'
		ORDER BY t.id`, siteID, siteID, siteID, siteID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, peer, subnet string
			if rows.Scan(&id, &peer, &subnet) == nil {
				ids = append(ids, id)
				b.WriteString("\n[Peer]\n# " + peer + "\nPublicKey  = <peer-public-key>\nAllowedIPs = " + subnet + "\nPersistentKeepalive = 25\n")
			}
		}
	}
	return b.String(), ids
}
