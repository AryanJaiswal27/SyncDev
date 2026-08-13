package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"syncdev-daemon/fs"
	"syncdev-daemon/ws"
)

func main() {
	projectRoot := os.Getenv("PROJECT_ROOT")
	if projectRoot == "" {
		projectRoot = "g:\\SyncDev"
	}

	// Initialize the File System watcher
	fsWatcher := fs.NewWatcher(projectRoot)

	// Initialize the WebSocket Server
	wsServer := ws.NewServer(fsWatcher)

	enableCORS := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next(w, r)
		}
	}

	// Route definitions
	http.HandleFunc("/ws", wsServer.HandleConnections)

	// Endpoint to get the recursive file tree
	http.HandleFunc("/fs/tree", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		tree, err := fsWatcher.GetTree()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(tree)
	}))

	// Endpoint to read file contents
	http.HandleFunc("/fs/read", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		filePath := r.URL.Query().Get("path")
		if filePath == "" {
			http.Error(w, "path query parameter required", http.StatusBadRequest)
			return
		}

		if !filepath.IsAbs(filePath) {
			filePath = filepath.Join(projectRoot, filePath)
		}

		content, err := os.ReadFile(filePath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		w.Write(content)
	}))

	// Endpoint to write file contents
	http.HandleFunc("/fs/write", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			FilePath string `json:"filePath"`
			Content  string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if !filepath.IsAbs(req.FilePath) {
			req.FilePath = filepath.Join(projectRoot, req.FilePath)
		}
		if err := os.WriteFile(req.FilePath, []byte(req.Content), 0644); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	// Endpoint to create a directory
	http.HandleFunc("/fs/create_dir", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			return
		}
		var req struct {
			DirPath string `json:"dirPath"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if !filepath.IsAbs(req.DirPath) {
			req.DirPath = filepath.Join(projectRoot, req.DirPath)
		}
		if err := os.MkdirAll(req.DirPath, 0755); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	// Endpoint to move/rename
	http.HandleFunc("/fs/move", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			return
		}
		var req struct {
			OldPath string `json:"oldPath"`
			NewPath string `json:"newPath"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if !filepath.IsAbs(req.OldPath) {
			req.OldPath = filepath.Join(projectRoot, req.OldPath)
		}
		if !filepath.IsAbs(req.NewPath) {
			req.NewPath = filepath.Join(projectRoot, req.NewPath)
		}
		if err := os.Rename(req.OldPath, req.NewPath); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	// Endpoint to replace specific substring in a file
	http.HandleFunc("/fs/replace", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			return
		}
		var req struct {
			FilePath string `json:"filePath"`
			Search   string `json:"search"`
			Replace  string `json:"replace"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if !filepath.IsAbs(req.FilePath) {
			req.FilePath = filepath.Join(projectRoot, req.FilePath)
		}
		content, err := os.ReadFile(req.FilePath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		newContent := strings.ReplaceAll(string(content), req.Search, req.Replace)
		if err := os.WriteFile(req.FilePath, []byte(newContent), 0644); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	// Endpoint to run terminal command
	http.HandleFunc("/terminal/run", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			return
		}
		var req struct {
			Command string `json:"command"`
			Cwd     string `json:"cwd"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if req.Cwd == "" {
			req.Cwd = projectRoot
		}

		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()

		cmd := exec.CommandContext(ctx, "powershell", "-NoProfile", "-NonInteractive", "-Command", req.Command)
		cmd.Dir = req.Cwd
		out, err := cmd.CombinedOutput()
		res := map[string]string{"output": string(out)}
		if err != nil {
			if ctx.Err() == context.DeadlineExceeded {
				res["error"] = "Command timed out after 15 seconds"
			} else {
				res["error"] = err.Error()
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(res)
	}))

	// Endpoint to broadcast a WS message (used by AI Orchestrator to stream step updates)
	http.HandleFunc("/ws/broadcast", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			return
		}
		var msg interface{}
		if err := json.NewDecoder(r.Body).Decode(&msg); err == nil {
			wsServer.Broadcast(msg)
		}
		w.WriteHeader(http.StatusOK)
	}))

	// Start server
	port := ":8080"
	fmt.Printf("SyncDev Desktop Daemon running on http://localhost%s (Project Root: %s)\n", port, projectRoot)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
