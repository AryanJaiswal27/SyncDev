package ws

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"syncdev-daemon/fs"
)

func TestWebSocketConnection(t *testing.T) {
	mockWatcher := &fs.Watcher{}
	server := NewServer(mockWatcher)

	// Create a test HTTP server with the WS handler
	s := httptest.NewServer(http.HandlerFunc(server.HandleConnections))
	defer s.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(s.URL, "http")

	// Connect to the server
	ws, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket: %v", err)
	}
	defer ws.Close()

	// Wait briefly to allow server to register client
	time.Sleep(50 * time.Millisecond)

	server.mu.Lock()
	if len(server.clients) != 1 {
		t.Errorf("Expected 1 connected client, got %d", len(server.clients))
	}
	server.mu.Unlock()

	// Test JSON parsing doesn't crash on invalid data
	err = ws.WriteMessage(websocket.TextMessage, []byte(`invalid json`))
	if err != nil {
		t.Fatalf("Failed to write message: %v", err)
	}
}
