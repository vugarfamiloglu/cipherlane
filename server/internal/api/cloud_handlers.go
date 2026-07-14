package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"cipherlane/internal/db"
)

// createCloud provisions a cloud-VPC site plus its connector.
func (s *Server) createCloud(w http.ResponseWriter, r *http.Request) {
	var b struct{ Name, Provider, Region, VpcId, SubnetCidr string }
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(b.Name) == "" || strings.TrimSpace(b.Provider) == "" {
		writeErr(w, http.StatusBadRequest, "name and provider are required")
		return
	}
	now := time.Now().Unix()
	siteID := db.NewID("site")
	code := strings.ToUpper(b.Provider) + "-" + strings.ToUpper(strings.ReplaceAll(b.Region, " ", ""))
	if _, err := s.DB.Exec(`INSERT INTO sites(id,name,code,kind,location,subnet_cidr,status,created_at,updated_at)
		VALUES(?,?,?,?,?,?,?,?,?)`, siteID, b.Name, code, "cloud", b.Region, def(b.SubnetCidr, "10.60.0.0/16"), "online", now, now); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	ccID := db.NewID("cc")
	if _, err := s.DB.Exec(`INSERT INTO cloud_connectors(id,site_id,provider,region,vpc_id,status,created_at)
		VALUES(?,?,?,?,?,?,?)`, ccID, siteID, strings.ToLower(b.Provider), b.Region, b.VpcId, "connected", now); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "cloud.connect", b.Name)
	writeJSON(w, http.StatusCreated, map[string]any{"id": ccID, "siteId": siteID})
}

// deleteCloud removes a connector and its cloud site (cascading tunnels).
func (s *Server) deleteCloud(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var siteID string
	if s.DB.QueryRow(`SELECT site_id FROM cloud_connectors WHERE id=?`, id).Scan(&siteID) == sql.ErrNoRows {
		writeErr(w, http.StatusNotFound, "connector not found")
		return
	}
	_, _ = s.DB.Exec(`DELETE FROM cloud_connectors WHERE id=?`, id)
	if siteID != "" {
		_, _ = s.DB.Exec(`DELETE FROM sites WHERE id=?`, siteID)
	}
	s.Sim.Reload()
	s.audit(r, "cloud.disconnect", id)
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}

// cloudConfig streams a provider-specific site-to-site tunnel config.
func (s *Server) cloudConfig(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var provider, region, vpc, siteName, cidr string
	err := s.DB.QueryRow(`SELECT c.provider, c.region, c.vpc_id, COALESCE(si.name,''), COALESCE(si.subnet_cidr,'')
		FROM cloud_connectors c LEFT JOIN sites si ON si.id = c.site_id WHERE c.id=?`, id).
		Scan(&provider, &region, &vpc, &siteName, &cidr)
	if err == sql.ErrNoRows {
		writeErr(w, http.StatusNotFound, "connector not found")
		return
	}
	cfg := fmt.Sprintf(`# Cipherlane site-to-site tunnel — %s (%s)
# VPC: %s   remote subnet: %s

conn cipherlane-%s
  keyexchange = ikev2
  ike  = aes256-sha256-modp2048
  esp  = aes256gcm16
  left = %%defaultroute
  leftsubnet = 10.10.0.0/16
  right = %%any
  rightsubnet = %s
  authby = psk
  auto = start
  dpdaction = restart
`, siteName, strings.ToUpper(provider), vpc, cidr, strings.ToLower(provider), def(cidr, "10.60.0.0/16"))

	name := "cipherlane-" + strings.ToLower(provider) + "-" + strings.ReplaceAll(region, " ", "") + ".conf"
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
	_, _ = w.Write([]byte(cfg))
	s.audit(r, "cloud.download_config", name)
}
