package auth

import "testing"

func TestPasscode(t *testing.T) {
	h, err := HashPasscode("cipherlane")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPasscode(h, "cipherlane") {
		t.Fatal("correct passcode should verify")
	}
	if VerifyPasscode(h, "wrong") {
		t.Fatal("wrong passcode should be rejected")
	}
}

func TestSessionToken(t *testing.T) {
	secret, err := NewSecret()
	if err != nil {
		t.Fatal(err)
	}
	tok, err := IssueToken(secret, Claims{Oid: "op_1", Role: "auditor", Name: "Aud"})
	if err != nil {
		t.Fatal(err)
	}
	c, ok := ParseToken(secret, tok)
	if !ok {
		t.Fatal("freshly issued token should be valid")
	}
	if c.Role != "auditor" || c.Oid != "op_1" {
		t.Fatalf("claims not preserved: %+v", c)
	}
	if _, ok := ParseToken(secret, tok+"x"); ok {
		t.Fatal("tampered token accepted")
	}
	if _, ok := ParseToken(secret, "garbage"); ok {
		t.Fatal("garbage token accepted")
	}
	other, _ := NewSecret()
	if _, ok := ParseToken(other, tok); ok {
		t.Fatal("token accepted under a different secret")
	}
}
