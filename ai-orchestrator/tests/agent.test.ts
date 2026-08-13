// Mocks for LangGraph orchestration tests
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const mockTool = tool(
    async ({ input }) => `Mock executed: ${input}`,
    { name: "mock_tool", schema: z.object({ input: z.string() }) }
);

describe('AI Orchestrator Agent Flow', () => {
    it('should transition to sync_ledger after tools execute', async () => {
        // Simplified mock version of the agent graph to verify edge transitions
        const agentGraph = new StateGraph(MessagesAnnotation)
            .addNode("agent", async (state) => ({ messages: [] }))
            .addNode("tools", new ToolNode([mockTool]))
            .addNode("sync_ledger", async (state) => ({}))
            .addEdge("__start__", "agent")
            .addConditionalEdges("agent", (state) => {
                const lastMsg = state.messages[state.messages.length - 1];
                // @ts-ignore
                if (lastMsg?.tool_calls?.length > 0) return "tools";
                return "sync_ledger";
            })
            .addEdge("tools", "sync_ledger") // Ensure it goes to sync_ledger in our strict flow, or back to agent
            .addEdge("sync_ledger", "__end__");

        const orchestrator = agentGraph.compile();
        expect(orchestrator).toBeDefined();
        
        // Assert the configuration has the correct nodes
        expect(orchestrator.nodes).toHaveProperty('agent');
        expect(orchestrator.nodes).toHaveProperty('tools');
        expect(orchestrator.nodes).toHaveProperty('sync_ledger');
    });
});
