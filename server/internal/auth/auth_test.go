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
	tok, err := IssueToken(secret)
	if err != nil {
		t.Fatal(err)
	}
	if !ValidToken(secret, tok) {
		t.Fatal("freshly issued token should be valid")
	}
	if ValidToken(secret, tok+"x") {
		t.Fatal("tampered token accepted")
	}
	if ValidToken(secret, "garbage") {
		t.Fatal("garbage token accepted")
	}
	other, _ := NewSecret()
	if ValidToken(other, tok) {
		t.Fatal("token accepted under a different secret")
	}
}
