// Package auth handles passcode verification and stateless HMAC session tokens
// delivered as an http-only cookie. Secrets are supplied by the caller (loaded
// from the settings table on boot), never hard-coded.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// CookieName is the session cookie key.
const CookieName = "cl_session"

// SessionTTL is how long an issued session stays valid.
const SessionTTL = 12 * time.Hour

// HashPasscode returns a bcrypt hash suitable for storage.
func HashPasscode(passcode string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(passcode), 10)
	return string(b), err
}

// VerifyPasscode reports whether passcode matches the stored hash.
func VerifyPasscode(hash, passcode string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(passcode)) == nil
}

// NewSecret returns 32 cryptographically-random bytes, base64-encoded.
func NewSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(b), nil
}

// IssueToken creates a signed token that expires after SessionTTL.
func IssueToken(secret string) (string, error) {
	key, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		return "", err
	}
	exp := time.Now().Add(SessionTTL).Unix()
	payload := make([]byte, 8)
	binary.BigEndian.PutUint64(payload, uint64(exp))
	mac := sign(key, payload)
	return base64.RawURLEncoding.EncodeToString(payload) + "." +
		base64.RawURLEncoding.EncodeToString(mac), nil
}

// ValidToken reports whether the token is well-formed, unexpired, and signed.
func ValidToken(secret, token string) bool {
	key, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		return false
	}
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || len(payload) != 8 {
		return false
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return false
	}
	want := sign(key, payload)
	if subtle.ConstantTimeCompare(sig, want) != 1 {
		return false
	}
	exp := int64(binary.BigEndian.Uint64(payload))
	return time.Now().Unix() < exp
}

// SetCookie writes the session cookie on the response.
func SetCookie(w http.ResponseWriter, token string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(SessionTTL.Seconds()),
	})
}

// ClearCookie expires the session cookie.
func ClearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name: CookieName, Value: "", Path: "/", HttpOnly: true, MaxAge: -1,
	})
}

// TokenFromRequest extracts the session token from the cookie.
func TokenFromRequest(r *http.Request) (string, error) {
	c, err := r.Cookie(CookieName)
	if err != nil {
		return "", errors.New("no session")
	}
	return c.Value, nil
}

func sign(key, payload []byte) []byte {
	m := hmac.New(sha256.New, key)
	m.Write(payload)
	return m.Sum(nil)
}
