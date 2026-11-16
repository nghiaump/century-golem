package session

import (
	"os"
	"regexp"
	"testing"
)

// AIs are named after the golem on their avatar: the list must be complete, unique, and identical to
// the frontend's AVATAR_NAMES (web/react-frontend/src/utils/avatar.js), which labels the same pictures.
func TestAvatarNames_MatchFrontendAndAreUnique(t *testing.T) {
	if len(avatarNames) != 24 || avatarCount != 24 {
		t.Fatalf("want 24 golem avatars, got %d", len(avatarNames))
	}
	seen := map[string]bool{}
	for _, n := range avatarNames {
		if n == "" || seen[n] {
			t.Fatalf("avatar names must be unique and non-empty: %q", n)
		}
		seen[n] = true
	}
	if aiName("1", 1) != "Basalt" || aiName("24", 1) != "Squall" || aiName("0", 3) != "AI 3" || aiName("x", 2) != "AI 2" {
		t.Fatal("aiName must map avatar ids 1..24 to golem names and fall back to \"AI k\"")
	}

	js, err := os.ReadFile("../../web/react-frontend/src/utils/avatar.js")
	if err != nil {
		t.Skipf("frontend source not available: %v", err)
	}
	block := regexp.MustCompile(`(?s)AVATAR_NAMES = \[(.*?)\]`).FindSubmatch(js)
	if block == nil {
		t.Fatal("AVATAR_NAMES not found in avatar.js")
	}
	var front []string
	for _, m := range regexp.MustCompile(`'([^']+)'`).FindAllSubmatch(block[1], -1) {
		front = append(front, string(m[1]))
	}
	if len(front) != len(avatarNames) {
		t.Fatalf("frontend has %d avatar names, server %d", len(front), len(avatarNames))
	}
	for i := range front {
		if front[i] != avatarNames[i] {
			t.Fatalf("avatar %d: frontend %q, server %q", i+1, front[i], avatarNames[i])
		}
	}
}
