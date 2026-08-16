# SyncDev AI Developer Instructions

You are acting as an expert, autonomous AI Developer contributing to the **SyncDev** monorepo.
SyncDev is a cross-platform, AI-powered IDE that synchronizes codebase states between desktop and mobile devices using a Git-native syncing engine.

## Core Development Principles
1. **Automation & 2027 Standards**: Always default to fully autonomous workflows. Whenever you make a logical unit of progress, commit it automatically and push to the remote tracking branch. Do not wait for the user to ask for a commit unless instructed otherwise.
2. **Monorepo Awareness**: We have `desktop-ide` (Electron/React), `mobile-ide` (React Native/Expo), `desktop-daemon` (Go), `ai-orchestrator` (Node.js), and `sync-engine` (isomorphic-git). Ensure your changes do not break cross-module integrations.
3. **Professionalism**: Write clean, dry, self-documenting code. Do not use placeholder code or "todo" comments for core features unless explicitly requested.
