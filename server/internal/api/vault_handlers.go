package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"cipherlane/internal/db"
	"cipherlane/internal/pki"
	"cipherlane/internal/wg"
)

// loadCA returns the persistent CA, creating and sealing it on first use.
func (s *Server) loadCA() (*pki.CA, error) {
	certPEM, ok1 := s.DB.GetSetting("ca_cert_pem")
	keyEnc, ok2 := s.DB.GetSetting("ca_key_enc")
	if ok1 && ok2 && certPEM != "" && keyEnc != "" {
		if keyPEM, err := s.Vault.Decrypt(keyEnc); err == nil {
			if ca, err := pki.Load(certPEM, keyPEM); err == nil {
				return ca, nil
			}
		}
	}
	ca, err := pki.NewCA("Cipherlane Root CA")
	if err != nil {
		return nil, err
	}
	keyPEM, err := ca.KeyPEM()
	if err != nil {
		return nil, err
	}
	enc, err := s.Vault.Encrypt(keyPEM)
	if err != nil {
		return nil, err
	}
	_ = s.DB.SetSetting("ca_cert_pem", ca.CertPEM())
	_ = s.DB.SetSetting("ca_key_enc", enc)
	_, _ = s.DB.Exec(`INSERT INTO certificates(id,name,kind,subject,fingerprint,status,not_after,created_at)
		VALUES(?,?,?,?,?,?,?,?)`, db.NewID("cert"), "Cipherlane Root CA", "ca", ca.Subject(), ca.Fingerprint(), "valid", ca.NotAfter(), time.Now().Unix())
	return ca, nil
}

func (s *Server) issueCert(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Name, Subject, Kind string
		Days                int
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(b.Name) == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	ca, err := s.loadCA()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "CA error: "+err.Error())
		return
	}
	days := b.Days
	if days <= 0 {
		days = 365
	}
	kind := "client"
	if b.Kind == "server" {
		kind = "server"
	}
	leaf, err := ca.Issue(def(b.Subject, "CN="+b.Name), days, kind == "server")
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "issue failed: "+err.Error())
		return
	}
	id := db.NewID("cert")
	if _, err := s.DB.Exec(`INSERT INTO certificates(id,name,kind,subject,fingerprint,status,not_after,created_at)
		VALUES(?,?,?,?,?,?,?,?)`, id, b.Name, kind, def(b.Subject, "CN="+b.Name), leaf.Fingerprint, "valid", leaf.NotAfter, time.Now().Unix()); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "certificate.issue", b.Name)
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "fingerprint": leaf.Fingerprint, "certPem": leaf.CertPEM})
}

func (s *Server) revokeCert(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	res, _ := s.DB.Exec(`UPDATE certificates SET status='revoked' WHERE id=? AND kind != 'ca'`, id)
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusBadRequest, "certificate not found or is the CA")
		return
	}
	s.audit(r, "certificate.revoke", id)
	writeJSON(w, http.StatusOK, map[string]any{"revoked": true})
}

func (s *Server) deleteCert(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	res, _ := s.DB.Exec(`DELETE FROM certificates WHERE id=? AND kind != 'ca'`, id)
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusBadRequest, "certificate not found or is the CA")
		return
	}
	s.audit(r, "certificate.delete", id)
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}

func (s *Server) generateKey(w http.ResponseWriter, r *http.Request) {
	var b struct{ Name, Kind string }
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(b.Name) == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	var public, secret string
	if b.Kind == "psk" {
		raw := make([]byte, 32)
		_, _ = rand.Read(raw)
		secret = base64.StdEncoding.EncodeToString(raw)
	} else {
		b.Kind = "wireguard"
		priv, pub, err := wg.GenerateKeypair()
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "keygen failed")
			return
		}
		public, secret = pub, priv
	}
	sealed, err := s.Vault.Encrypt(secret)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "vault error")
		return
	}
	id := db.NewID("key")
	if _, err := s.DB.Exec(`INSERT INTO keys(id,name,kind,public_material,secret_encrypted,created_at) VALUES(?,?,?,?,?,?)`,
		id, b.Name, b.Kind, public, sealed, time.Now().Unix()); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "key.generate", b.Name)
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "publicMaterial": public})
}

func (s *Server) revealKey(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var name, enc string
	if s.DB.QueryRow(`SELECT name, secret_encrypted FROM keys WHERE id=?`, id).Scan(&name, &enc) != nil {
		writeErr(w, http.StatusNotFound, "key not found")
		return
	}
	if enc == "" {
		writeErr(w, http.StatusBadRequest, "no sealed secret for this key")
		return
	}
	secret, err := s.Vault.Decrypt(enc)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "decrypt failed")
		return
	}
	s.audit(r, "key.reveal", name)
	writeJSON(w, http.StatusOK, map[string]any{"secret": secret})
}

func (s *Server) deleteKey(w http.ResponseWriter, r *http.Request) {
	s.deleteEntity(w, r, "keys", "key.delete")
}
