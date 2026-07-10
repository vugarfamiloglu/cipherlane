// Package totp implements RFC 6238 time-based one-time passwords (SHA-1, 6
// digits, 30-second step) with a ±1 window, used for operator MFA.
package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// NewSecret returns a fresh base32 secret (no padding).
func NewSecret() string {
	b := make([]byte, 20)
	_, _ = rand.Read(b)
	return strings.TrimRight(base32.StdEncoding.EncodeToString(b), "=")
}

// URI builds an otpauth:// provisioning URI for authenticator apps.
func URI(secret, account, issuer string) string {
	label := url.PathEscape(issuer + ":" + account)
	q := url.Values{}
	q.Set("secret", secret)
	q.Set("issuer", issuer)
	q.Set("algorithm", "SHA1")
	q.Set("digits", "6")
	q.Set("period", "30")
	return "otpauth://totp/" + label + "?" + q.Encode()
}

// Generate returns the 6-digit code for a secret at time t.
func Generate(secret string, t time.Time) (string, error) {
	key, err := base32.StdEncoding.DecodeString(pad(secret))
	if err != nil {
		return "", err
	}
	counter := uint64(t.Unix() / 30)
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, counter)
	h := hmac.New(sha1.New, key)
	h.Write(buf)
	sum := h.Sum(nil)
	off := sum[len(sum)-1] & 0x0f
	v := (int(sum[off])&0x7f)<<24 | (int(sum[off+1])&0xff)<<16 | (int(sum[off+2])&0xff)<<8 | (int(sum[off+3]) & 0xff)
	return fmt.Sprintf("%06d", v%1_000_000), nil
}

// Verify reports whether input matches the secret within a ±1 step window.
func Verify(secret, input string) bool {
	input = strings.TrimSpace(input)
	if len(input) != 6 {
		return false
	}
	now := time.Now()
	for _, d := range []time.Duration{-30 * time.Second, 0, 30 * time.Second} {
		if code, err := Generate(secret, now.Add(d)); err == nil && hmacEqual(code, input) {
			return true
		}
	}
	return false
}

func hmacEqual(a, b string) bool {
	return hmac.Equal([]byte(a), []byte(b))
}

func pad(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	if m := len(s) % 8; m != 0 {
		s += strings.Repeat("=", 8-m)
	}
	return s
}
