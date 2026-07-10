// Package vault provides AES-256-GCM encryption for secrets at rest (private
// keys, PSKs, certificate material). The 32-byte master key is generated on
// first boot and stored with 0600 permissions under the data dir.
package vault

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"path/filepath"
)

// Vault encrypts and decrypts short secret strings.
type Vault struct {
	aead cipher.AEAD
}

// Open loads the master key from path, creating it on first use.
func Open(path string) (*Vault, error) {
	key, err := loadOrCreateKey(path)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Vault{aead: aead}, nil
}

// Encrypt returns base64(nonce || ciphertext) for the given plaintext.
func (v *Vault) Encrypt(plaintext string) (string, error) {
	nonce := make([]byte, v.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := v.aead.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// Decrypt reverses Encrypt.
func (v *Vault) Decrypt(encoded string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	ns := v.aead.NonceSize()
	if len(raw) < ns {
		return "", errors.New("vault: ciphertext too short")
	}
	nonce, ct := raw[:ns], raw[ns:]
	plain, err := v.aead.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func loadOrCreateKey(path string) ([]byte, error) {
	if b, err := os.ReadFile(path); err == nil && len(b) == 32 {
		return b, nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, key, 0o600); err != nil {
		return nil, err
	}
	return key, nil
}
