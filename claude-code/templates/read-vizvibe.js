#!/usr/bin/env node

/**
 * SessionStart Hook: Read vizvibe.mmd
 *
 * This hook runs when a Claude Code session starts.
 * It reads vizvibe.mmd and outputs it as context for Claude.
 */

const fs = require('fs');
const path = require('path');

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const trajectoryPath = path.join(projectDir, 'vizvibe.mmd');
const vizvibePath = path.join(projectDir, '.claude', 'hooks', 'VIZVIBE.md');
const stateFile = path.join(projectDir, '.claude', 'hooks', 'state.json');

function extractLastActiveNode(content) {
  const match = content.match(/%% @lastActive:\s*(\w+)/);
  return match ? match[1] : null;
}

function updateStateWithLastActive(lastActiveNode) {
  try {
    let state = { mode: 'idle', updatedAt: new Date().toISOString() };
    if (fs.existsSync(stateFile)) {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    }
    state.lastActiveNode = lastActiveNode;
    fs.writeFileSync(stateFile, JSON.stringify(state));
  } catch (e) {}
}

// Check if vizvibe.mmd exists
if (!fs.existsSync(trajectoryPath)) {
  process.exit(0);
}

const trajectory = fs.readFileSync(trajectoryPath, 'utf-8');

// Extract lastActiveNode and update state
const lastActiveNode = extractLastActiveNode(trajectory);
if (lastActiveNode) {
  updateStateWithLastActive(lastActiveNode);
}

// Extract node descriptions from comments
const nodeDescriptions = [];
const nodeIds = [];
const lines = trajectory.split('\n');
for (const line of lines) {
  const match = line.match(/%% @([\w-]+) \[([\w-]+)(?:,\s*\w+)?\]: (.+)/);
  if (match) {
    const [, nodeId, nodeType, description] = match;
    nodeIds.push(nodeId);
    const isActive = nodeId === lastActiveNode ? ' ⬅️ RECENT' : '';
    nodeDescriptions.push(`- [${nodeType}] ${description}${isActive}`);
  }
}

// Check if trajectory is in template state (only has project_start node)
const isTemplateState = nodeIds.length === 1 && nodeIds[0] === 'project_start';

// Read VIZVIBE.md if exists
let vizvibeMdContent = '';
if (fs.existsSync(vizvibePath)) {
  vizvibeMdContent = fs.readFileSync(vizvibePath, 'utf-8');
}

// Build context message
let context;

if (isTemplateState) {
  // Template state - request initial trajectory creation
  context = `=== Viz Vibe: Initial Setup Required ===

⚠️ **ACTION REQUIRED**: This project has Viz Vibe installed but the trajectory is empty (template state).

Please create an initial trajectory based on:
1. Our conversation history (if any)
2. The codebase structure and recent git commits
3. README.md and other documentation

Read the guide at .claude/hooks/VIZVIBE.md for detailed instructions on how to structure the trajectory.

After analyzing the project, update vizvibe.mmd with:
- Project goals (ultimate and current)
- Completed work as [closed] nodes
- Planned work as [opened] nodes
- Proper connections between related nodes

---
${vizvibeMdContent}
`;
} else {
  // Normal state - show current trajectory
  const lastActiveInfo = lastActiveNode ? `\nLast active node: ${lastActiveNode}` : '';
  context = `=== Viz Vibe: Project Trajectory ===

This project uses Viz Vibe to track work history. When you complete tasks, update vizvibe.mmd.
${lastActiveInfo}

Current trajectory has ${nodeDescriptions.length} nodes:
${nodeDescriptions.slice(-5).join('\n')}
${nodeDescriptions.length > 5 ? `\n... and ${nodeDescriptions.length - 5} more nodes` : ''}

**Important**: When updating vizvibe.mmd, also update the \`%% @lastActive: node_id\` line with the node you just worked on.

---
${vizvibeMdContent}
`;
}

// Output as JSON with additionalContext
const output = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: context
  }
};

console.log(JSON.stringify(output));
