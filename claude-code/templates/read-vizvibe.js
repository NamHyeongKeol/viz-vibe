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

// Check if vizvibe.mmd exists
if (!fs.existsSync(trajectoryPath)) {
  process.exit(0);
}

const trajectory = fs.readFileSync(trajectoryPath, 'utf-8');

// Extract node descriptions from comments
const nodeDescriptions = [];
const lines = trajectory.split('\n');
for (const line of lines) {
  const match = line.match(/%% @([\w-]+) \[([\w-]+)\]: (.+)/);
  if (match) {
    const [, nodeId, nodeType, description] = match;
    nodeDescriptions.push(`- [${nodeType}] ${description}`);
  }
}

// Build context message
let context = `=== Viz Vibe: Project Trajectory ===

This project uses Viz Vibe to track work history. When you complete tasks, update vizvibe.mmd.

Current trajectory has ${nodeDescriptions.length} nodes:
${nodeDescriptions.slice(-5).join('\n')}
${nodeDescriptions.length > 5 ? `\n... and ${nodeDescriptions.length - 5} more nodes` : ''}

See .claude/hooks/VIZVIBE.md for formatting guide.
`;

// Output as JSON with additionalContext
const output = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: context
  }
};

console.log(JSON.stringify(output));
