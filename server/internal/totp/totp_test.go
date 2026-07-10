package totp

import (
	"testing"
	"time"
)

func TestGenerateVerify(t *testing.T) {
	secret := NewSecret()
	code, err := Generate(secret, time.Now())
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if len(code) != 6 {
		t.Fatalf("want 6 digits, got %q", code)
	}
	if !Verify(secret, code) {
		t.Fatal("Verify should accept the current code")
	}
}

func TestGenerateDeterministic(t *testing.T) {
	secret := "JBSWY3DPEHPK3PXP"
	at := time.Unix(1_700_000_000, 0)
	a, err := Generate(secret, at)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := Generate(secret, at)
	if a != b {
		t.Fatalf("nondeterministic: %s != %s", a, b)
	}
	// Codes in different 30s windows should (almost always) differ.
	c, _ := Generate(secret, at.Add(60*time.Second))
	if a == c {
		t.Fatal("codes did not advance across windows")
	}
}

func TestVerifyRejectsGarbage(t *testing.T) {
	secret := NewSecret()
	for _, bad := range []string{"", "12", "abcdef", "1234567"} {
		if Verify(secret, bad) {
			t.Fatalf("accepted invalid code %q", bad)
		}
	}
}
