package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// disconnectSession ends a live remote-access session.
func (s *Server) disconnectSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	res, err := s.DB.Exec(`DELETE FROM sessions WHERE id=?`, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "session not found")
		return
	}
	s.Sim.DropSession(id)
	s.audit(r, "session.disconnect", id)
	writeJSON(w, http.StatusOK, map[string]any{"disconnected": true})
}

// resolveAlert marks an alert resolved.
func (s *Server) resolveAlert(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	res, err := s.DB.Exec(`UPDATE alerts SET status='resolved' WHERE id=?`, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeErr(w, http.StatusNotFound, "alert not found")
		return
	}
	s.audit(r, "alert.resolve", id)
	writeJSON(w, http.StatusOK, map[string]any{"resolved": true})
}
