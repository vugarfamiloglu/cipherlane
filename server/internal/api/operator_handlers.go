package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"cipherlane/internal/auth"
	"cipherlane/internal/db"
	"cipherlane/internal/models"
)

func (s *Server) operatorByEmail(email string) (models.Operator, bool) {
	var o models.Operator
	err := s.DB.QueryRow(`SELECT id,name,email,role,password_hash,status,created_at,updated_at FROM operators WHERE email=?`,
		strings.ToLower(strings.TrimSpace(email))).
		Scan(&o.ID, &o.Name, &o.Email, &o.Role, &o.PasswordHash, &o.Status, &o.CreatedAt, &o.UpdatedAt)
	return o, err == nil
}

// canManageOps reports whether the caller may create/edit/delete operators.
func (s *Server) canManageOps(r *http.Request) bool {
	role := claims(r).Role
	return role == "owner" || role == "admin"
}

func (s *Server) listOperators(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Query(`SELECT id,name,email,role,status,created_at,updated_at FROM operators
		ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'operator' THEN 2 ELSE 3 END, name`)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []models.Operator{}
	for rows.Next() {
		var o models.Operator
		if rows.Scan(&o.ID, &o.Name, &o.Email, &o.Role, &o.Status, &o.CreatedAt, &o.UpdatedAt) == nil {
			out = append(out, o)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) createOperator(w http.ResponseWriter, r *http.Request) {
	if !s.canManageOps(r) {
		writeErr(w, http.StatusForbidden, "only owners and admins can manage operators")
		return
	}
	var b struct{ Name, Email, Role, Password string }
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	b.Email = strings.ToLower(strings.TrimSpace(b.Email))
	if strings.TrimSpace(b.Name) == "" || b.Email == "" || len(b.Password) < 6 {
		writeErr(w, http.StatusBadRequest, "name, email, and a 6+ char password are required")
		return
	}
	hash, err := auth.HashPasscode(b.Password)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "hash error")
		return
	}
	id, now := db.NewID("op"), time.Now().Unix()
	if _, err := s.DB.Exec(`INSERT INTO operators(id,name,email,role,password_hash,status,created_at,updated_at)
		VALUES(?,?,?,?,?,?,?,?)`, id, b.Name, b.Email, def(b.Role, "operator"), hash, "active", now, now); err != nil {
		writeErr(w, http.StatusBadRequest, "could not create operator (email may already exist)")
		return
	}
	s.audit(r, "operator.create", b.Email)
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (s *Server) updateOperator(w http.ResponseWriter, r *http.Request) {
	if !s.canManageOps(r) {
		writeErr(w, http.StatusForbidden, "only owners and admins can manage operators")
		return
	}
	id := chi.URLParam(r, "id")
	var b struct{ Name, Email, Role, Status, Password string }
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(b.Password) != "" {
		if len(b.Password) < 6 {
			writeErr(w, http.StatusBadRequest, "password must be at least 6 characters")
			return
		}
		hash, _ := auth.HashPasscode(b.Password)
		_, _ = s.DB.Exec(`UPDATE operators SET password_hash=? WHERE id=?`, hash, id)
	}
	_, err := s.DB.Exec(`UPDATE operators SET name=?, email=?, role=?, status=?, updated_at=? WHERE id=?`,
		b.Name, strings.ToLower(strings.TrimSpace(b.Email)), def(b.Role, "operator"), def(b.Status, "active"), time.Now().Unix(), id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.audit(r, "operator.update", b.Email)
	writeJSON(w, http.StatusOK, map[string]any{"updated": true})
}

func (s *Server) deleteOperator(w http.ResponseWriter, r *http.Request) {
	if !s.canManageOps(r) {
		writeErr(w, http.StatusForbidden, "only owners and admins can manage operators")
		return
	}
	id := chi.URLParam(r, "id")
	var role string
	if s.DB.QueryRow(`SELECT role FROM operators WHERE id=?`, id).Scan(&role) == nil && role == "owner" {
		writeErr(w, http.StatusBadRequest, "cannot delete an owner")
		return
	}
	s.deleteEntity(w, r, "operators", "operator.delete")
}
