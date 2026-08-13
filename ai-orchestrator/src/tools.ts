import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { indexer } from './indexer';

// We define tools that will communicate with the Go Desktop Daemon.
// The Go Daemon is running locally (e.g., on port 8080) and has access to the filesystem and terminal.

export const readFileTool = tool(
  async ({ filePath }) => {
    try {
      const res = await fetch(`http://127.0.0.1:8080/fs/read?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) return `Error reading file: ${res.statusText}`;
      return await res.text();
    } catch(err: any) { return err.message; }
  },
  {
    name: "read_file",
    description: "Reads the content of a file from the user's workspace.",
    schema: z.object({
      filePath: z.string().describe("The relative path of the file to read."),
    }),
  }
);

export const writeFileTool = tool(
  async ({ filePath, content }) => {
    try {
      const res = await fetch(`http://127.0.0.1:8080/fs/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content })
      });
      if (!res.ok) return `Error writing file: ${res.statusText}`;
      return `File ${filePath} written successfully.`;
    } catch(err: any) { return err.message; }
  },
  {
    name: "write_file",
    description: "Writes content to a file in the user's workspace (overwrites existing).",
    schema: z.object({
      filePath: z.string().describe("The relative path of the file to write."),
      content: z.string().describe("The complete content to write to the file."),
    }),
  }
);

export const replaceCodeTool = tool(
  async ({ filePath, search, replace }) => {
    try {
      const res = await fetch(`http://127.0.0.1:8080/fs/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, search, replace })
      });
      if (!res.ok) return `Error replacing code: ${res.statusText}`;
      return `Successfully replaced code in ${filePath}.`;
    } catch(err: any) { return err.message; }
  },
  {
    name: "replace_code",
    description: "Surgically replaces a specific substring with new code inside a file.",
    schema: z.object({
      filePath: z.string().describe("The relative path of the file to modify."),
      search: z.string().describe("The exact existing string to search for."),
      replace: z.string().describe("The new string to replace it with."),
    }),
  }
);

export const createDirTool = tool(
  async ({ dirPath }) => {
    try {
      const res = await fetch(`http://127.0.0.1:8080/fs/create_dir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirPath })
      });
      if (!res.ok) return `Error creating directory: ${res.statusText}`;
      return `Directory ${dirPath} created successfully.`;
    } catch(err: any) { return err.message; }
  },
  {
    name: "create_dir",
    description: "Creates a new folder/directory.",
    schema: z.object({
      dirPath: z.string().describe("The relative path of the directory to create."),
    }),
  }
);

export const moveFileTool = tool(
  async ({ oldPath, newPath }) => {
    try {
      const res = await fetch(`http://127.0.0.1:8080/fs/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newPath })
      });
      if (!res.ok) return `Error moving file/directory: ${res.statusText}`;
      return `Moved ${oldPath} to ${newPath} successfully.`;
    } catch(err: any) { return err.message; }
  },
  {
    name: "move_file",
    description: "Moves or renames a file or directory.",
    schema: z.object({
      oldPath: z.string().describe("The current relative path of the file/folder."),
      newPath: z.string().describe("The new relative path of the file/folder."),
    }),
  }
);

export const runCommandTool = tool(
  async ({ command, cwd }) => {
    try {
      const res = await fetch(`http://127.0.0.1:8080/terminal/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, cwd: cwd || "" })
      });
      const data = await res.json();
      if (data.error) return `Command Failed: ${data.error}\nOutput:\n${data.output}`;
      return `Command succeeded. Output:\n${data.output}`;
    } catch(err: any) { return err.message; }
  },
  {
    name: "run_command",
    description: "Executes a terminal command in the workspace.",
    schema: z.object({
      command: z.string().describe("The terminal command to execute (e.g., 'npm test')."),
      cwd: z.string().optional().describe("Optional working directory relative to project root."),
    }),
  }
);

export const planTaskTool = tool(
  async ({ planSteps }) => {
    return `Plan drafted successfully with ${planSteps.length} steps. You may now execute step 1.`;
  },
  {
    name: "plan_task",
    description: "Drafts a detailed plan for the current objective before executing.",
    schema: z.object({
      planSteps: z.array(z.string()).describe("A list of concrete steps you will take to achieve the goal."),
    }),
  }
);

export const semanticSearchTool = tool(
  async ({ query }) => {
    console.log(`[Semantic Search] Searching vector database for: "${query}"`);
    return await indexer.search(query);
  },
  {
    name: "semantic_search",
    description: "Searches the local project's semantic vector database for code snippets relevant to the query.",
    schema: z.object({
      query: z.string().describe("A natural language query describing what code you are looking for (e.g. 'websocket connection logic')."),
    }),
  }
);
