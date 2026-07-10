package vault

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRoundTrip(t *testing.T) {
	v, err := Open(filepath.Join(t.TempDir(), ".vault-key"))
	if err != nil {
		t.Fatal(err)
	}
	secret := "wireguard-private-key-\U0001F4A7"
	enc, err := v.Encrypt(secret)
	if err != nil {
		t.Fatal(err)
	}
	if enc == secret {
		t.Fatal("ciphertext equals plaintext")
	}
	dec, err := v.Decrypt(enc)
	if err != nil {
		t.Fatal(err)
	}
	if dec != secret {
		t.Fatalf("got %q want %q", dec, secret)
	}
}

func TestKeyPersists(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".vault-key")
	v1, _ := Open(path)
	enc, _ := v1.Encrypt("x")
	v2, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if dec, err := v2.Decrypt(enc); err != nil || dec != "x" {
		t.Fatalf("reopen decrypt failed: %v %q", err, dec)
	}
	if info, err := os.Stat(path); err != nil || info.Size() != 32 {
		t.Fatalf("key file missing or wrong size: %v", err)
	}
}

func TestDecryptRejectsTamper(t *testing.T) {
	v, _ := Open(filepath.Join(t.TempDir(), ".k"))
	if _, err := v.Decrypt("not base64!!!"); err == nil {
		t.Fatal("expected error on bad base64")
	}
	if _, err := v.Decrypt("YWJj"); err == nil {
		t.Fatal("expected error on short ciphertext")
	}
}
