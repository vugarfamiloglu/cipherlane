package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"cipherlane/internal/auth"
)

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Passcode string `json:"passcode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if !auth.VerifyPasscode(s.Passcode, strings.TrimSpace(body.Passcode)) {
		writeErr(w, http.StatusUnauthorized, "invalid passcode")
		return
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
