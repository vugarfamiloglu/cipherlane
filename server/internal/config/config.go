// Package config resolves runtime configuration from the environment with
// sensible local-first defaults. No secrets live here — session and vault keys
// are provisioned on first boot and stored under the (git-ignored) data dir.
package config

import (
	"os"
	"path/filepath"
)

// Config holds the resolved runtime settings for the control plane.
type Config struct {
	Addr         string // listen address, e.g. ":7820"
	DataDir      string // git-ignored directory for db + keys
	DBPath       string // sqlite database file
	VaultKeyPath string // AES-256-GCM master key file
	WebDir       string // built frontend assets (production)
	Dev          bool   // relaxes CORS for the Vite dev server
}

// Load reads configuration from the environment, applying defaults.
func Load() Config {
	dataDir := env("CIPHERLANE_DATA", "data")
	return Config{
		Addr:         env("CIPHERLANE_ADDR", ":7820"),
		DataDir:      dataDir,
		DBPath:       filepath.Join(dataDir, "cipherlane.db"),
		VaultKeyPath: filepath.Join(dataDir, ".vault-key"),
		WebDir:       env("CIPHERLANE_WEB", filepath.Join("..", "web", "dist")),
		Dev:          env("CIPHERLANE_DEV", "1") == "1",
	}
}

func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
