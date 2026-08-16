---
name: build-monorepo
description: Teaches the agent how to build, run, and test the SyncDev monorepo and its 4 core components.
---

# Building and Running the SyncDev Monorepo

The SyncDev monorepo consists of 4 distinct services that must be run together for full integration testing. 

## Running the Application
The root `package.json` is configured with `concurrently` to spin up all services.
To boot the full environment, run the following command from the root directory (`/`):
```bash
npm start
```
This will sequentially boot the Desktop Daemon, AI Orchestrator, Desktop IDE, and Mobile IDE sandbox.

## Installing Dependencies
When you pull a new version or modify a `package.json` in any of the sub-modules, you must run:
```bash
npm run install:all
```
This ensures that `npm install` is executed in all 4 module directories.

## Testing
We use Jest for Node/React tests and standard Go tests for the backend.
- To run tests across the monorepo, use:
```bash
npm test
```
