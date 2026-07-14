package pki

import (
	"strings"
	"testing"
)

func TestCAIssue(t *testing.T) {
	ca, err := NewCA("Test Root CA")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(ca.CertPEM(), "BEGIN CERTIFICATE") {
		t.Fatal("CA cert is not PEM")
	}
	leaf, err := ca.Issue("client-1", 30, false)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(leaf.CertPEM, "BEGIN CERTIFICATE") {
		t.Fatal("leaf cert is not PEM")
	}
	if len(leaf.Fingerprint) != 23 { // 8 bytes as XX joined by ":"
		t.Fatalf("unexpected fingerprint format: %q", leaf.Fingerprint)
	}
	if leaf.NotAfter <= 0 {
		t.Fatal("leaf has no expiry")
	}
}

func TestLoadRoundTrip(t *testing.T) {
	ca, _ := NewCA("Roundtrip CA")
	keyPEM, err := ca.KeyPEM()
	if err != nil {
		t.Fatal(err)
	}
	ca2, err := Load(ca.CertPEM(), keyPEM)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ca2.Issue("server-1", 90, true); err != nil {
		t.Fatalf("reloaded CA cannot issue: %v", err)
	}
}
