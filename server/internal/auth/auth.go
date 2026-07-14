// Package auth handles passcode/operator verification and stateless HMAC session
// tokens (a signed JSON claim set) delivered as an http-only cookie.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
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

// Claims is the signed session payload.
type Claims struct {
	Exp  int64  `json:"exp"`
	Oid  string `json:"oid"`  // operator id ("owner" for passcode sign-in)
	Role string `json:"role"` // owner | admin | operator | auditor
	Name string `json:"name"`
}

// HashPasscode returns a bcrypt hash suitable for storage.
func HashPasscode(passcode string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(passcode), 10)
	return string(b), err
}

// VerifyPasscode reports whether passcode matches the stored hash.
func VerifyPasscode(hash, passcode string) bool {
	return hash != "" && bcrypt.CompareHashAndPassword([]byte(hash), []byte(passcode)) == nil
}

// NewSecret returns 32 cryptographically-random bytes, base64-encoded.
func NewSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(b), nil
}

// IssueToken creates a signed token for the given claims (expiry is set here).
func IssueToken(secret string, c Claims) (string, error) {
	key, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		return "", err
	}
	c.Exp = time.Now().Add(SessionTTL).Unix()
	payload, err := json.Marshal(c)
	if err != nil {
		return "", err
	}
	sig := sign(key, payload)
	return base64.RawURLEncoding.EncodeToString(payload) + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

// ParseToken verifies the signature and expiry, returning the claims.
func ParseToken(secret, token string) (Claims, bool) {
	var c Claims
	key, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		return c, false
	}
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return c, false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return c, false
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return c, false
	}
	if subtle.ConstantTimeCompare(sig, sign(key, payload)) != 1 {
		return c, false
	}
	if json.Unmarshal(payload, &c) != nil {
		return c, false
	}
	if time.Now().Unix() >= c.Exp {
		return c, false
	}
	return c, true
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
