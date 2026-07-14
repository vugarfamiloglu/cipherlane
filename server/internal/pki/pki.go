// Package pki is a tiny real certificate authority: a self-signed ECDSA CA that
// issues short-lived client/server leaf certificates.
package pki

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
)

// CA is a self-signed certificate authority.
type CA struct {
	cert *x509.Certificate
	key  *ecdsa.PrivateKey
}

// NewCA creates a fresh 10-year self-signed CA.
func NewCA(commonName string) (*CA, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	tmpl := &x509.Certificate{
		SerialNumber:          serial(),
		Subject:               pkix.Name{CommonName: commonName, Organization: []string{"Cipherlane"}},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().AddDate(10, 0, 0),
		IsCA:                  true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return nil, err
	}
	cert, err := x509.ParseCertificate(der)
	if err != nil {
		return nil, err
	}
	return &CA{cert: cert, key: key}, nil
}

// Load reconstructs a CA from stored PEM material.
func Load(certPEM, keyPEM string) (*CA, error) {
	cb, _ := pem.Decode([]byte(certPEM))
	kb, _ := pem.Decode([]byte(keyPEM))
	if cb == nil || kb == nil {
		return nil, errors.New("pki: invalid PEM material")
	}
	cert, err := x509.ParseCertificate(cb.Bytes)
	if err != nil {
		return nil, err
	}
	key, err := x509.ParseECPrivateKey(kb.Bytes)
	if err != nil {
		return nil, err
	}
	return &CA{cert: cert, key: key}, nil
}

// CertPEM returns the CA certificate in PEM form.
func (c *CA) CertPEM() string { return encode("CERTIFICATE", c.cert.Raw) }

// KeyPEM returns the CA private key in PEM form (store this sealed).
func (c *CA) KeyPEM() (string, error) {
	der, err := x509.MarshalECPrivateKey(c.key)
	if err != nil {
		return "", err
	}
	return encode("EC PRIVATE KEY", der), nil
}

// Subject and Fingerprint of the CA certificate.
func (c *CA) Subject() string     { return c.cert.Subject.String() }
func (c *CA) Fingerprint() string { return fingerprint(c.cert.Raw) }
func (c *CA) NotAfter() int64     { return c.cert.NotAfter.Unix() }

// Leaf is an issued certificate.
type Leaf struct {
	CertPEM     string
	Fingerprint string
	NotAfter    int64
}

// Issue signs a leaf certificate for the given common name.
func (c *CA) Issue(commonName string, days int, server bool) (Leaf, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return Leaf{}, err
	}
	notAfter := time.Now().AddDate(0, 0, days)
	eku := x509.ExtKeyUsageClientAuth
	if server {
		eku = x509.ExtKeyUsageServerAuth
	}
	tmpl := &x509.Certificate{
		SerialNumber: serial(),
		Subject:      pkix.Name{CommonName: commonName, Organization: []string{"Cipherlane"}},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     notAfter,
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{eku},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, c.cert, &key.PublicKey, c.key)
	if err != nil {
		return Leaf{}, err
	}
	return Leaf{CertPEM: encode("CERTIFICATE", der), Fingerprint: fingerprint(der), NotAfter: notAfter.Unix()}, nil
}

func serial() *big.Int {
	n, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	return n
}

func encode(typ string, der []byte) string {
	return string(pem.EncodeToMemory(&pem.Block{Type: typ, Bytes: der}))
}

// fingerprint returns the first 8 bytes of the SHA-256 digest as AB:CD:… hex.
func fingerprint(der []byte) string {
	sum := sha256.Sum256(der)
	parts := make([]string, 8)
	for i := 0; i < 8; i++ {
		parts[i] = fmt.Sprintf("%02X", sum[i])
	}
	return strings.Join(parts, ":")
}
