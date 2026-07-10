// Package db opens the SQLite store (WAL mode, pure-Go driver), applies the
// schema, and exposes a tiny settings key/value helper used for bootstrap
// secrets. All queries elsewhere are parameterized.
package db

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// DB wraps *sql.DB with domain helpers.
type DB struct {
	*sql.DB
}

// Open creates/opens the database, enabling WAL, foreign keys, and a busy
// timeout, then applies the schema (idempotent).
func Open(path string) (*DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	dsn := "file:" + path +
		"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)"
	sdb, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// Single connection serializes writes and sidesteps SQLITE_BUSY on Windows;
	// this control plane is not write-heavy.
	sdb.SetMaxOpenConns(1)
	if err := sdb.Ping(); err != nil {
		return nil, err
	}
	if _, err := sdb.Exec(schema); err != nil {
		return nil, err
	}
	return &DB{sdb}, nil
}

// GetSetting reads a settings value.
func (d *DB) GetSetting(key string) (string, bool) {
	var v string
	if err := d.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&v); err != nil {
		return "", false
	}
	return v, true
}

// SetSetting upserts a settings value.
func (d *DB) SetSetting(key, value string) error {
	_, err := d.Exec(
		"INSERT INTO settings(key, value) VALUES(?, ?) "+
			"ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		key, value)
	return err
}

// NewID returns a URL-friendly prefixed random identifier.
func NewID(prefix string) string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}
