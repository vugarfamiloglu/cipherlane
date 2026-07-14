// Package wg generates real WireGuard (Curve25519) key pairs and renders client
// configuration files for device enrolment.
package wg

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"golang.org/x/crypto/curve25519"
)

// GenerateKeypair returns a base64-encoded WireGuard private and public key.
func GenerateKeypair() (privB64, pubB64 string, err error) {
	var priv [32]byte
	if _, err = rand.Read(priv[:]); err != nil {
		return "", "", err
	}
	// Curve25519 clamping, per the WireGuard spec.
	priv[0] &= 248
	priv[31] &= 127
	priv[31] |= 64
	pub, err := curve25519.X25519(priv[:], curve25519.Basepoint)
	if err != nil {
		return "", "", err
	}
	return base64.StdEncoding.EncodeToString(priv[:]), base64.StdEncoding.EncodeToString(pub), nil
}

// ClientConfig renders a peer configuration for an enrolled device.
func ClientConfig(privKey, address, serverPubKey, endpoint, allowedIPs, dns string) string {
	return fmt.Sprintf(`[Interface]
PrivateKey = %s
Address    = %s/32
DNS        = %s

[Peer]
PublicKey  = %s
Endpoint   = %s
AllowedIPs = %s
PersistentKeepalive = 25
`, privKey, address, dns, serverPubKey, endpoint, allowedIPs)
}
