---
name: sync-ledger
description: Instructions and guidelines for modifying or interacting with the git-native Sync Engine.
---

# Modifying the Sync Engine

The `sync-engine` is the most critical module in this repository. It uses `isomorphic-git` to maintain the Sync Ledger across devices.

## Rules for Modification:
1. **Never bypass isomorphic-git**: All file system writes that represent user code must be immediately staged and committed using the `isomorphic-git` wrapper in `sync-engine/git-sync.ts`.
2. **AI Memory (`ledger.ts`)**: The AI's context and memory are stored in the Sync Ledger. When adding new features that modify state, ensure you append to the ledger correctly so the AI retains memory across desktop and mobile sessions.
3. **Conflict Resolution**: If you introduce new file types or data structures, ensure you update the conflict resolution strategy in the engine. It defaults to a "last write wins" strategy for non-text files, but uses intelligent diff merging for text/code.
