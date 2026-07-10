package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"cipherlane/internal/totp"
)

func (s *Server) mfaStatus(w http.ResponseWriter, r *http.Request) {
	en, _ := s.DB.GetSetting("totp_enabled")
	writeJSON(w, http.StatusOK, map[string]any{"enabled": en == "1"})
}

// mfaSetup generates a fresh secret, seals it, and returns the provisioning URI.
func (s *Server) mfaSetup(w http.ResponseWriter, r *http.Request) {
	if v, _ := s.DB.GetSetting("totp_enabled"); v == "1" {
		writeErr(w, http.StatusBadRequest, "MFA is already enabled")
		return
	}
	secret := totp.NewSecret()
	enc, err := s.Vault.Encrypt(secret)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "vault error")
		return
	}
	_ = s.DB.SetSetting("totp_secret", enc)
	writeJSON(w, http.StatusOK, map[string]any{
		"secret":     secret,
		"otpauthUri": totp.URI(secret, "operator", "Cipherlane"),
	})
}

func (s *Server) mfaActivate(w http.ResponseWriter, r *http.Request) {
	var b struct{ Code string }
	_ = json.NewDecoder(r.Body).Decode(&b)
	secret, ok := s.decryptSetting("totp_secret")
	if !ok {
		writeErr(w, http.StatusBadRequest, "run setup first")
		return
	}
	if !totp.Verify(secret, strings.TrimSpace(b.Code)) {
		writeErr(w, http.StatusUnauthorized, "invalid code")
		return
	}
	_ = s.DB.SetSetting("totp_enabled", "1")
	s.audit(r, "mfa.enable", "operator")
	writeJSON(w, http.StatusOK, map[string]any{"enabled": true})
}

func (s *Server) mfaDisable(w http.ResponseWriter, r *http.Request) {
	var b struct{ Code string }
	_ = json.NewDecoder(r.Body).Decode(&b)
	secret, ok := s.decryptSetting("totp_secret")
	if ok && !totp.Verify(secret, strings.TrimSpace(b.Code)) {
		writeErr(w, http.StatusUnauthorized, "invalid code")
		return
	}
	_ = s.DB.SetSetting("totp_enabled", "0")
	_ = s.DB.SetSetting("totp_secret", "")
	s.audit(r, "mfa.disable", "operator")
	writeJSON(w, http.StatusOK, map[string]any{"enabled": false})
}

func (s *Server) decryptSetting(key string) (string, bool) {
	enc, ok := s.DB.GetSetting(key)
	if !ok || enc == "" {
		return "", false
	}
	v, err := s.Vault.Decrypt(enc)
	if err != nil {
		return "", false
	}
	return v, true
}
