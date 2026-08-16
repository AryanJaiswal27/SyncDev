---
description: Enforces strict backend standards for the Go Daemon and Node.js AI Orchestrator.
trigger: model_decision
---

# Backend Coding Standards

When modifying `desktop-daemon` (Go) or `ai-orchestrator` (Node.js):

1. **Go Daemon**:
   - Prioritize high-performance, concurrent execution using goroutines appropriately.
   - Maintain strict file system watcher reliability and efficient WebSocket routing.
   - Ensure errors are not swallowed. Log appropriately and gracefully handle OS-level permissions.
2. **AI Orchestrator (Node.js/LangGraph)**:
   - Ensure the LangGraph state machine handles edge cases smoothly.
   - LLM calls must enforce strictly structured outputs (e.g., JSON schemas) for reliable diff rendering.
   - Ensure embedding lookups (hnswlib) are optimized for speed and token limits are respected.
3. **Cross-Service Communication**:
   - Changes to the API payload shape in one service MUST be reflected in the counterpart service.
