import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { readFileTool, writeFileTool, runCommandTool, semanticSearchTool, replaceCodeTool, createDirTool, moveFileTool, planTaskTool } from "./tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { LedgerManager } from "sync-engine/ledger";

const systemPrompt = `You are the SyncDev AI Orchestrator, an advanced autonomous coding agent. 
You can use tools to navigate the file system, read/write files, replace specific code snippets, create directories, move files, and run terminal commands. 
Work step-by-step. Draft a plan before doing complex tasks.
When proposing code modifications directly to the user in chat (instead of using tools), DO NOT just output markdown code blocks. Instead, output exactly a JSON structure: {"type": "code_diff", "file": "filename", "diff": "your diff here"}`;

const projectRoot = process.env.PROJECT_ROOT || "g:\\SyncDev";
const ledgerManager = new LedgerManager(projectRoot);

function createAgentGraph(selectedModel: string) {
  const rawApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!rawApiKey) {
    throw new Error("API Key is undefined! Please check your .env file.");
  }
  const apiKey = rawApiKey.trim();
  let llm: any;

  const allTools = [readFileTool, writeFileTool, runCommandTool, semanticSearchTool, replaceCodeTool, createDirTool, moveFileTool, planTaskTool];
  
  if (selectedModel && selectedModel.startsWith('gpt')) {
    llm = new ChatOpenAI({
      modelName: selectedModel,
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
    }).bindTools(allTools);
  } else {
    // Standard Gemini model instantiation
    llm = new ChatGoogleGenerativeAI({
      model: selectedModel || "gemini-3.5-flash",
      temperature: 0,
      apiKey: apiKey,
    }).bindTools(allTools);
  }

  const agentGraph = new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      const response = await llm.invoke(state.messages);
      return { messages: [response] };
    })
    .addNode("tools", new ToolNode(allTools))
    .addNode("sync_ledger", async (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      await ledgerManager.appendInteraction({
        timestamp: new Date().toISOString(),
        userPrompt: "Derived from memory state",
        agentAction: "LANGGRAPH_NODE_END",
        agentPayload: typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content)
      });
      return {}; 
    })
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", (state) => {
      const lastMsg = state.messages[state.messages.length - 1];
      // @ts-ignore
      if (lastMsg?.tool_calls?.length > 0) return "tools";
      return "sync_ledger";
    })
    .addEdge("tools", "agent")
    .addEdge("sync_ledger", "__end__");

  return agentGraph.compile();
}

// --- EXPRESS SERVER LOGIC ---
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/models', async (req, res) => {
  try {
    const rawApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!rawApiKey) {
      return res.json({ models: [{ id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" }] });
    }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${rawApiKey.trim()}`);
    if (!response.ok) {
      return res.status(500).json({ error: "Failed to fetch models" });
    }
    const data = await response.json();
    const models = data.models
      .filter((m: any) => m.name.includes("gemini"))
      .map((m: any) => ({
        id: m.name.replace("models/", ""),
        name: m.displayName || m.name.replace("models/", "")
      }));
    res.json({ models });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.payload || req.body.message;
    const requestedModel = req.body.model || "gemini-3.5-flash";
    
    if (!userMessage) return res.status(400).send("Message required");

    try {
        console.log(`[AI Orchestrator] Processing prompt with model: ${requestedModel}`);
        const orchestrator = createAgentGraph(requestedModel);
        
        const stream = await orchestrator.stream({ 
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ] 
        });

        let finalMessage = "";

        for await (const chunk of stream) {
            // Check if agent used a tool
            if (chunk.agent && chunk.agent.messages && chunk.agent.messages.length > 0) {
                const msg = chunk.agent.messages[0];
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    const toolName = msg.tool_calls[0].name;
                    console.log(`[AI Orchestrator] Agent invoked tool: ${toolName}`);
                    // Broadcast intermediate step to Desktop Daemon!
                    fetch("http://127.0.0.1:8080/ws/broadcast", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "agent_step", payload: `Agent is using tool: ${toolName}...` })
                    }).catch(err => console.error("Broadcast err", err));
                }
                if (msg.content) {
                    finalMessage = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                }
            }
        }
        
        res.send(finalMessage || "Task completed successfully.");
    } catch (err: any) {
        console.error("Agent Error:", err);
        const errMsg = err?.message || JSON.stringify(err);
        res.send(`AI Error: ${errMsg}`);
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`SyncDev AI Orchestrator running on http://127.0.0.1:${PORT}`);
});
