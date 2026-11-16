package server

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"
	"time"

	"golem_century/internal/avatars"
	"golem_century/internal/config"
)

// A player's own avatar picture is deleted from the server together with the room that used it.
func TestCustomAvatar_DeletedWithTheRoom(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 64, 64))
	for i := 0; i < 64; i++ {
		img.Set(i, i, color.RGBA{200, 10, uint8(i), 255})
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	avatar, err := avatars.Default.Put(buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	id, _ := avatars.ID(avatar)

	gs := newCleanupTestServer(config.Config{SessionIdleWaitingSeconds: 1})
	gs.CreateSessionV2("avatar_room", 2, 60)
	avatars.Default.Attach("avatar_room", avatar) // what the WebSocket join does

	time.Sleep(20 * time.Millisecond)
	if _, ok := avatars.Default.Get(id); !ok {
		t.Fatal("picture kept while the room exists")
	}
	waitUntil(t, 5*time.Second, func() bool { _, ok := gs.GetSessionV2("avatar_room"); return !ok }, "idle room should be removed")
	if _, ok := avatars.Default.Get(id); ok {
		t.Fatal("picture must be deleted together with its room")
	}
}
