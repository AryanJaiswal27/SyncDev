package agent

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// SessionMemory represents the persistent AI context ledger
type SessionMemory struct {
	ProjectID    string            `json:"project_id"`
	SystemPrompt string            `json:"system_prompt"`
	History      []Interaction     `json:"history"`
	Context      map[string]string `json:"context"`
}

// Interaction stores structured AI responses to prevent hallucination
type Interaction struct {
	Timestamp    time.Time `json:"timestamp"`
	UserPrompt   string    `json:"user_prompt"`
	AgentAction  string    `json:"agent_action"` // E.g., 'EDIT_FILE', 'RUN_COMMAND'
	AgentPayload string    `json:"agent_payload"`
}

// SaveLedger writes the memory state to the .prompt/ folder
func SaveLedger(rootDir string, memory SessionMemory) error {
	promptDir := filepath.Join(rootDir, ".prompt")
	if err := os.MkdirAll(promptDir, 0755); err != nil {
		return err
	}
	
	data, err := json.MarshalIndent(memory, "", "  ")
	if err != nil {
		return err
	}
	
	ledgerPath := filepath.Join(promptDir, "ledger.json")
	return os.WriteFile(ledgerPath, data, 0644)
}
