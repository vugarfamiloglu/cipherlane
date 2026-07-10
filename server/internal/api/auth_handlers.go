package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"cipherlane/internal/auth"
	"cipherlane/internal/totp"
)

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Passcode string `json:"passcode"`
		Code     string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if !auth.VerifyPasscode(s.Passcode, strings.TrimSpace(body.Passcode)) {
		writeErr(w, http.StatusUnauthorized, "invalid passcode")
		return
	}
	if en, _ := s.DB.GetSetting("totp_enabled"); en == "1" {
		if strings.TrimSpace(body.Code) == "" {
			writeErr(w, http.StatusUnauthorized, "mfa_required")
			return
		}
		secret, ok := s.decryptSetting("totp_secret")
		if !ok || !totp.Verify(secret, strings.TrimSpace(body.Code)) {
			writeErr(w, http.StatusUnauthorized, "invalid MFA code")
			return
		}
	}
	token, err := auth.IssueToken(s.Secret)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create session")
		return
	}
	auth.SetCookie(w, token, !s.Cfg.Dev)
	writeJSON(w, http.StatusOK, map[string]any{"authenticated": true})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	auth.ClearCookie(w)
	writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	tok, err := auth.TokenFromRequest(r)
	ok := err == nil && auth.ValidToken(s.Secret, tok)
	writeJSON(w, http.StatusOK, map[string]any{"authenticated": ok})
}
