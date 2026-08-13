![Group project meme](./group%20project%20meme.webp)
![Slave meme](./slave%20meme.jpg)

# SyncDev

SyncDev is an AI-powered, cross-platform Integrated Development Environment (IDE) that enables seamless collaborative software development across desktop and mobile devices.

## Overview
SyncDev eliminates the friction of working across multiple devices by synchronizing your codebase instantly between desktop and mobile platforms using Git-based synchronization. It is tightly integrated with an autonomous AI Orchestrator that provides context-aware code generation and assistance directly within the editor.

## System Architecture

The SyncDev monorepo consists of five core components:

1. **Desktop IDE (`/desktop-ide`)**
   - An Electron and React-based frontend providing a robust, extensible desktop development environment powered by the Monaco Editor.
2. **Mobile IDE (`/mobile-ide`)**
   - A React Native mobile application, allowing you to code and review from anywhere.
3. **Desktop Daemon (`/desktop-daemon`)**
   - A high-performance Go service running in the background. It watches the file system for local changes and interfaces with the operating system.
4. **AI Orchestrator (`/ai-orchestrator`)**
   - A Node.js backend using LangChain (LangGraph, Google GenAI, OpenAI) and `hnswlib` for vector embeddings. This acts as the "brain," offering semantic code search, contextual autocomplete, and autonomous AI-driven development.
5. **Sync Engine (`/sync-engine`)**
   - A core module built around `isomorphic-git` that reliably synchronizes the codebase state across all your devices in real-time.

## Getting Started

1. Clone the repository
2. Run `npm run install:all` to install dependencies for all modules.
3. Start the entire environment with `npm start`.

## License
MIT
