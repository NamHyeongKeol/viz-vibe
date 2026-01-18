#!/usr/bin/env node

/**
 * Viz Vibe - SessionStart Hook (Global Install Version)
 * 
 * This hook runs when a Claude Code session starts.
 * It reads the trajectory and provides context to Claude.
 * 
 * Supports both v2.0 (.vizvibe/ folder) and legacy (vizvibe.mmd in root) structures.
 */

const fs = require('fs');
const path = require('path');

// Get directories
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const homeDir = process.env.HOME || process.env.USERPROFILE;
const vizvibeHome = process.env.VIZVIBE_HOME || path.join(homeDir, '.vizvibe');

// v2.0 paths
const vizvibeDir = path.join(projectDir, '.vizvibe');
const v2TrajectoryPath = path.join(vizvibeDir, 'trajectory.mmd');
const nodesDir = path.join(vizvibeDir, 'nodes');
const v2StateFile = path.join(vizvibeDir, 'state.json');

// Legacy paths
const legacyTrajectoryPath = path.join(projectDir, 'vizvibe.mmd');
const legacyStateFile = path.join(projectDir, '.vizvibe-state.json');

// Skill paths
const skillPath = path.join(vizvibeHome, 'skills', 'vizvibe', 'SKILL.md');
const claudeSkillPath = path.join(homeDir, '.claude', 'skills', 'vizvibe', 'SKILL.md');

// Determine which structure to use
const isV2 = fs.existsSync(v2TrajectoryPath);
const trajectoryPath = isV2 ? v2TrajectoryPath : legacyTrajectoryPath;
const stateFile = isV2 ? v2StateFile : legacyStateFile;

function extractLastActiveNode(content) {
  const match = content.match(/%% @lastActive:\s*([\w-]+)/);
  return match ? match[1] : null;
}

function updateStateWithLastActive(lastActiveNode) {
  try {
    let state = { mode: 'idle', updatedAt: new Date().toISOString() };
    if (fs.existsSync(stateFile)) {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    }
    state.lastActiveNode = lastActiveNode;
    state.version = isV2 ? '2.0' : '1.0';
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (e) {}
}

function readActiveNodeDoc(nodeId) {
  if (!isV2 || !nodeId) return null;
  
  const nodeDocPath = path.join(nodesDir, `@${nodeId}.md`);
  if (fs.existsSync(nodeDocPath)) {
    try {
      return fs.readFileSync(nodeDocPath, 'utf-8');
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Check if trajectory exists
if (!fs.existsSync(trajectoryPath)) {
  // No trajectory file - exit silently
  process.exit(0);
}

const trajectory = fs.readFileSync(trajectoryPath, 'utf-8');

// Extract lastActiveNode and update state
const lastActiveNode = extractLastActiveNode(trajectory);
if (lastActiveNode) {
  updateStateWithLastActive(lastActiveNode);
}

// Read active node's detailed documentation (Tier 1 context)
const activeNodeDoc = readActiveNodeDoc(lastActiveNode);

// Extract node descriptions from comments
const nodeDescriptions = [];
const nodeIds = [];
const lines = trajectory.split('\n');
for (const line of lines) {
  // Format: %% @node_id [type, state, date, author]
  let match = line.match(/%% @([\w-]+) \[([\w-]+)(?:,\s*\w+)?(?:,\s*[\d-]+)?(?:,\s*\w+)?\]/);
  if (match) {
    const [, nodeId, nodeType] = match;
    nodeIds.push(nodeId);
    const isActive = nodeId === lastActiveNode ? ' ⬅️ RECENT' : '';
    nodeDescriptions.push(`- [${nodeType}] ${nodeId}${isActive}`);
    continue;
  }
  
  // Legacy format: %% @node_id [type, state]: description
  match = line.match(/%% @([\w-]+) \[([\w-]+)(?:,\s*\w+)?\]: (.+)/);
  if (match) {
    const [, nodeId, nodeType, description] = match;
    nodeIds.push(nodeId);
    const isActive = nodeId === lastActiveNode ? ' ⬅️ RECENT' : '';
    nodeDescriptions.push(`- [${nodeType}] ${description}${isActive}`);
  }
}

// Check if trajectory is in template state
const isTemplateState = nodeIds.length <= 1 && (nodeIds.length === 0 || nodeIds[0] === 'project_start');

// Read SKILL.md from available locations
let skillContent = '';
for (const skillLoc of [skillPath, claudeSkillPath]) {
  if (fs.existsSync(skillLoc)) {
    skillContent = fs.readFileSync(skillLoc, 'utf-8');
    break;
  }
}

// Build context message
let context;
const structureInfo = isV2 ? '(v2.0 structure: .vizvibe/)' : '(legacy structure)';

if (isTemplateState) {
  // Template state - request initial trajectory creation
  context = `=== Viz Vibe: Initial Setup Required ${structureInfo} ===

⚠️ **ACTION REQUIRED**: This project has Viz Vibe installed but the trajectory is empty.

Please create an initial trajectory based on:
1. Our conversation history (if any)
2. The codebase structure and recent git commits
3. README.md and other documentation

After analyzing the project, update the trajectory with:
- Project goals (ultimate and current)
- Completed work as [closed] nodes
- Planned work as [opened] nodes
- Proper connections between related nodes
${isV2 ? '\n📁 **v2.0 Structure**: Also create detailed docs in `.vizvibe/nodes/@node_id.md` for complex tasks.' : ''}

---
${skillContent}
`;
} else {
  // Normal state - show current trajectory
  const lastActiveInfo = lastActiveNode ? `\n📍 Current focus: **${lastActiveNode}**` : '';
  
  // Build active node context section
  let activeNodeSection = '';
  if (activeNodeDoc) {
    // Limit to first 50 lines to avoid context overload
    const docLines = activeNodeDoc.split('\n').slice(0, 50);
    const truncated = activeNodeDoc.split('\n').length > 50 ? '\n... (truncated)' : '';
    activeNodeSection = `

--- Active Node Details (@${lastActiveNode}) ---
${docLines.join('\n')}${truncated}
`;
  } else if (isV2) {
    activeNodeSection = `

💡 No detailed doc found for @${lastActiveNode}. Consider creating \`.vizvibe/nodes/@${lastActiveNode}.md\`.
`;
  }

  context = `=== Viz Vibe: Project Trajectory ${structureInfo} ===

This project uses Viz Vibe to track work history.${lastActiveInfo}
${activeNodeSection}
--- Trajectory Overview (${nodeDescriptions.length} nodes) ---
${nodeDescriptions.slice(-7).join('\n')}
${nodeDescriptions.length > 7 ? `\n... and ${nodeDescriptions.length - 7} more nodes` : ''}

📝 **Node Documentation Rule**:
- When creating [opened] node → Create \`.vizvibe/nodes/@node_id.md\` (execution plan)
- When closing [closed] node → Update \`@node_id.md\` (post-mortem report)

---
${skillContent}
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

