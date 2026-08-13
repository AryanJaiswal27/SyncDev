package ws

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"syncdev-daemon/fs"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for the IDE
	},
}

type Server struct {
	fsWatcher *fs.Watcher
	clients   map[*websocket.Conn]bool
	mu        sync.Mutex
}

func NewServer(fsWatcher *fs.Watcher) *Server {
	return &Server{
		fsWatcher: fsWatcher,
		clients:   make(map[*websocket.Conn]bool),
	}
}

// Broadcast sends a message to all connected clients
func (s *Server) Broadcast(msg interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for client := range s.clients {
		err := client.WriteJSON(msg)
		if err != nil {
			log.Printf("Error broadcasting to client: %v", err)
			client.Close()
			delete(s.clients, client)
		}
	}
}

// HandleConnections upgrades HTTP to WS and handles the connection
func (s *Server) HandleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WS Upgrade Error: %v", err)
		return
	}
	defer ws.Close()

	s.mu.Lock()
	s.clients[ws] = true
	s.mu.Unlock()

	log.Printf("Mobile/Desktop client connected: %s", ws.RemoteAddr())

	for {
		_, msg, err := ws.ReadMessage()
		if err != nil {
			log.Printf("Client disconnected: %v", err)
			s.mu.Lock()
			delete(s.clients, ws)
			s.mu.Unlock()
			break
		}

		// Process incoming message
		var command map[string]interface{}
		if err := json.Unmarshal(msg, &command); err == nil {
			if command["type"] == "chat" {
				log.Printf("Forwarding prompt to AI Orchestrator...")

				go func(cmd map[string]interface{}, conn *websocket.Conn) {
					jsonBytes, _ := json.Marshal(cmd)
					resp, err := http.Post("http://127.0.0.1:3000/api/chat", "application/json", bytes.NewBuffer(jsonBytes))
					if err != nil {
						log.Printf("AI Orchestrator Error: %v", err)
						return
					}
					defer resp.Body.Close()
					body, _ := io.ReadAll(resp.Body)

					responseMsg := map[string]string{
						"type":    "chat_response",
						"payload": string(body),
					}
					s.mu.Lock()
					conn.WriteJSON(responseMsg)
					s.mu.Unlock()
				}(command, ws)
			}
		}
	}
}
