#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Tool input schemas
const UpdateTrajectorySchema = z.object({
  workspacePath: z.string().describe("Absolute path to the workspace root"),
  label: z.string().describe("Brief one-line summary of the task"),
  prompt: z.string().describe("Detailed description of what was done"),
  nodeType: z.enum(["ai-task", "human-task", "condition", "blocker"]).default("ai-task"),
});

// Node shape mapping - Simple & Professional
const nodeShapes = {
  'start': { open: '(["', close: '"])', style: 'fill:#10b981,stroke:#059669,color:#fff,stroke-width:2px' },
  'end': { open: '(["', close: '"])', style: 'fill:#64748b,stroke:#475569,color:#fff,stroke-width:2px' },
  'ai-task': { open: '["', close: '"]', style: 'fill:#334155,stroke:#475569,color:#f8fafc,stroke-width:1px' },
  'human-task': { open: '["', close: '"]', style: 'fill:#1e293b,stroke:#6366f1,color:#f8fafc,stroke-width:2px' },
  'condition': { open: '{"', close: '"}', style: 'fill:#0f172a,stroke:#f59e0b,color:#fbbf24,stroke-width:2px' },
  'blocker': { open: '{{"', close: '"}}', style: 'fill:#450a0a,stroke:#dc2626,color:#fca5a5,stroke-width:2px' }
};

// Parse existing Mermaid code to extract nodes
function extractNodes(code) {
  const nodes = [];
  const nodeRegex = /^\s+(\w+)(?:\[|\(|\{)/gm;
  let match;
  while ((match = nodeRegex.exec(code)) !== null) {
    if (!nodes.includes(match[1]) && match[1] !== 'style' && match[1] !== 'flowchart') {
      nodes.push(match[1]);
    }
  }
  return nodes;
}

// Parse metadata from comments
function parseMetadata(code) {
  const metadata = {};
  const metaRegex = /%% @(\w+) \[(\w+(?:-\w+)?)\]: (.+)/g;
  let match;
  while ((match = metaRegex.exec(code)) !== null) {
    metadata[match[1]] = {
      type: match[2],
      prompt: match[3]
    };
  }
  return metadata;
}

// Create server instance
const server = new Server(
  {
    name: "vizvibe-mcp-server",
    version: "0.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "update_trajectory",
        description: `Update the vizvibe.mmd file with a new node.
This file uses Mermaid flowchart syntax.
Call this tool AFTER completing any meaningful work to record your progress.`,
        inputSchema: {
          type: "object",
          properties: {
            workspacePath: {
              type: "string",
              description: "Absolute path to the workspace root (e.g., /Users/nam/my-project)",
            },
            label: {
              type: "string", 
              description: "Brief one-line summary of what was done (e.g., 'Implemented login page')",
            },
            prompt: {
              type: "string",
              description: "Detailed description of the task and any important context",
            },
            nodeType: {
              type: "string",
              enum: ["ai-task", "human-task", "condition", "blocker"],
              default: "ai-task",
              description: "Type of node to create",
            },
          },
          required: ["workspacePath", "label", "prompt"],
        },
      },
      {
        name: "get_trajectory",
        description: "Read the current vizvibe.mmd file to understand project history",
        inputSchema: {
          type: "object",
          properties: {
            workspacePath: {
              type: "string",
              description: "Absolute path to the workspace root",
            },
          },
          required: ["workspacePath"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "update_trajectory") {
    const parsed = UpdateTrajectorySchema.parse(args);
    const trajectoryPath = path.join(parsed.workspacePath, "vizvibe.mmd");

    try {
      // Read existing trajectory
      let mermaidCode;
      let lastNodeId = null;
      
      try {
        mermaidCode = fs.readFileSync(trajectoryPath, "utf-8");
        const nodes = extractNodes(mermaidCode);
        lastNodeId = nodes.length > 0 ? nodes[nodes.length - 1] : null;
      } catch {
        // Create new trajectory if doesn't exist
        const startId = 'project_start';
        mermaidCode = `flowchart TD
    %% @${startId} [start]: 프로젝트 시작
    ${startId}(["Project Start"])
    style ${startId} ${nodeShapes['start'].style}
`;
        lastNodeId = startId;
      }

      // Generate new node
      const timestamp = Date.now();
      const nodeId = `node_${timestamp}`;
      const shape = nodeShapes[parsed.nodeType] || nodeShapes['ai-task'];
      const safeLabel = parsed.label.replace(/"/g, "'").substring(0, 50);
      const safePrompt = parsed.prompt.replace(/\n/g, ' ').substring(0, 200);

      // Build new code block
      let newCode = '';
      newCode += `    %% @${nodeId} [${parsed.nodeType}]: ${safePrompt}\n`;
      newCode += `    ${nodeId}${shape.open}${safeLabel}${shape.close}\n`;
      if (lastNodeId) {
        newCode += `    ${lastNodeId} --> ${nodeId}\n`;
      }
      newCode += `    style ${nodeId} ${shape.style}\n`;

      // Append to existing code
      mermaidCode = mermaidCode.trimEnd() + '\n\n' + newCode;

      // Write back
      fs.writeFileSync(trajectoryPath, mermaidCode);

      return {
        content: [
          {
            type: "text",
            text: `✅ Trajectory updated successfully!
- New node: "${parsed.label}"
- Node ID: ${nodeId}
- Connected from: ${lastNodeId || '(none)'}
- File: ${trajectoryPath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to update trajectory: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "get_trajectory") {
    const workspacePath = args.workspacePath;
    const trajectoryPath = path.join(workspacePath, "vizvibe.mmd");

    try {
      const mermaidCode = fs.readFileSync(trajectoryPath, "utf-8");
      const nodes = extractNodes(mermaidCode);
      const metadata = parseMetadata(mermaidCode);

      // Create a readable summary
      const summary = nodes
        .map((id, i) => {
          const meta = metadata[id] || { type: 'unknown', prompt: '' };
          return `${i + 1}. [${meta.type}] ${id}${meta.prompt ? ': ' + meta.prompt.substring(0, 60) + '...' : ''}`;
        })
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `📊 Current Trajectory (${nodes.length} nodes):

${summary}

Format: Mermaid flowchart`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Could not read trajectory: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VizVibe MCP Server v0.2.0 (Mermaid format) running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
