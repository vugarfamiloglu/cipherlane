package wg

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestGenerateKeypair(t *testing.T) {
	priv, pub, err := GenerateKeypair()
	if err != nil {
		t.Fatal(err)
	}
	for name, k := range map[string]string{"private": priv, "public": pub} {
		b, err := base64.StdEncoding.DecodeString(k)
		if err != nil || len(b) != 32 {
			t.Fatalf("%s key invalid: %v len=%d", name, err, len(b))
		}
	}
	priv2, _, _ := GenerateKeypair()
	if priv == priv2 {
		t.Fatal("private keys are not unique")
	}
}

func TestClientConfig(t *testing.T) {
	priv, pub, _ := GenerateKeypair()
	cfg := ClientConfig(priv, "10.10.200.5", pub, "vpn.example:51820", "10.0.0.0/8", "1.1.1.1")
	for _, want := range []string{"[Interface]", "[Peer]", priv, pub, "PersistentKeepalive"} {
		if !strings.Contains(cfg, want) {
			t.Fatalf("config missing %q", want)
		}
	}
}
