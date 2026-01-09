import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { VizFlowEditorProvider } from './VizFlowEditorProvider';

const VIZVIBE_INITIALIZED_KEY = 'vizVibe.initialized';

export function activate(context: vscode.ExtensionContext) {
    console.log('Viz Vibe extension is now active!');

    // Register Custom Editor for .mmd files
    context.subscriptions.push(VizFlowEditorProvider.register(context));

    // Set default editor for .mmd files
    setDefaultEditorForMmd();

    // Check if we should prompt for initialization
    checkAndPromptInitialization(context);

    // Register command to manually initialize Viz Vibe
    context.subscriptions.push(
        vscode.commands.registerCommand('vizVibe.initProject', () => {
            initializeVizVibe(context, true);
        })
    );

    // Register command to create new workflow file
    context.subscriptions.push(
        vscode.commands.registerCommand('vizVibe.createWorkflow', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('Please open a workspace first');
                return;
            }

            const fileName = await vscode.window.showInputBox({
                prompt: 'Enter workflow file name',
                value: 'workflow.mmd'
            });

            if (fileName) {
                const filePath = vscode.Uri.joinPath(workspaceFolders[0].uri, fileName);
                const defaultContent = `flowchart TD
    %% @start [start]: Workflow start point
    start(["Start"])

    style start fill:#10b981,stroke:#059669,color:#fff,stroke-width:2px
`;

                await vscode.workspace.fs.writeFile(filePath, Buffer.from(defaultContent, 'utf-8'));
                const doc = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage(`Created ${fileName}`);
            }
        })
    );

    // Register simple test command for keybinding verification
    context.subscriptions.push(
        vscode.commands.registerCommand('vizVibe.test', async () => {
            vscode.window.showInformationMessage('Viz Vibe: Keybinding works!');
        })
    );

    // Register command to record current turn via AI
    context.subscriptions.push(
        vscode.commands.registerCommand('vizVibe.recordTurn', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('Please open a workspace first');
                return;
            }

            const workspacePath = workspaceFolders[0].uri.fsPath;
            
            // Check if vizvibe.mmd exists
            const mmdPath = vscode.Uri.joinPath(workspaceFolders[0].uri, 'vizvibe.mmd');
            let mmdExists = false;
            try {
                await vscode.workspace.fs.stat(mmdPath);
                mmdExists = true;
            } catch {
                mmdExists = false;
            }

            if (!mmdExists) {
                vscode.window.showWarningMessage('vizvibe.mmd not found. Run "Viz Vibe: Initialize Project" first.');
                return;
            }
            
            // Construct a message for AI to update trajectory based on recent conversation
            const message = `[Viz Vibe] Please update vizvibe.mmd based on the work done in this conversation.

**Instructions:**
1. First, read the vizvibe.mmd file
2. Add new nodes for the tasks completed in this conversation
3. Node format: \`%% @node_id [type, state]: description\`
4. Connect to existing nodes appropriately
5. Use 'closed' state for completed tasks, 'opened' for in-progress

workspacePath: ${workspacePath}`;

            // Copy to clipboard - this works across all editors
            await vscode.env.clipboard.writeText(message);
            vscode.window.showInformationMessage('📋 Viz Vibe: Update request copied to clipboard. Paste in AI chat to update trajectory.');
        })
    );

    // Register search command for graph view (Cmd+F)
    context.subscriptions.push(
        vscode.commands.registerCommand('vizVibe.searchGraph', () => {
            // This command is triggered by keybinding, the webview handles it via message
            // The webview itself captures keyboard events, but VS Code intercepts Cmd+F
            // So we need to send a message to the active webview
            VizFlowEditorProvider.triggerSearch();
        })
    );
}

async function checkAndPromptInitialization(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspaceRoot = workspaceFolders[0].uri;

    // Check if .mmd file already exists
    const mmdFiles = await vscode.workspace.findFiles('**/*.mmd', '**/node_modules/**', 1);
    if (mmdFiles.length > 0) {
        // Already has mmd, just ensure global rules exist
        await updateGlobalGeminiRules();
        return;
    }

    // No .mmd file - always ask (no alreadyAsked check)
    const selection = await vscode.window.showInformationMessage(
        '🚀 Would you like to set up Viz Vibe for this project?\n\nAI will automatically record work history in a graph.',
        'Yes',
        'No'
    );

    if (selection === 'Yes') {
        await initializeVizVibe(context, false);
    }
    // If 'No' - just skip, will ask again next time project is opened
}

async function initializeVizVibe(context: vscode.ExtensionContext, showSuccess: boolean) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('Please open a workspace first');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri;

    try {
        // 1. Create vizvibe.mmd
        await createTrajectoryFile(workspaceRoot);

        // 2. Set up environment-specific integrations
        await updateGlobalGeminiRules();  // Antigravity
        await setupCursorHooks(workspaceRoot);  // Cursor

        // Mark as initialized
        const workspaceKey = `${VIZVIBE_INITIALIZED_KEY}.${workspaceRoot.fsPath}`;
        await context.globalState.update(workspaceKey, true);

        if (showSuccess) {
            vscode.window.showInformationMessage('✅ Viz Vibe has been set up for this project!');
        } else {
            const openTrajectory = await vscode.window.showInformationMessage(
                '✅ Viz Vibe has been set up for this project!',
                'Open vizvibe.mmd'
            );
            if (openTrajectory) {
                const trajectoryUri = vscode.Uri.joinPath(workspaceRoot, 'vizvibe.mmd');
                // Open with Custom Editor (Graph View) directly
                await vscode.commands.executeCommand('vscode.openWith', trajectoryUri, 'vizVibe.vizflowEditor');
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Viz Vibe setup failed: ${error}`);
    }
}

async function createTrajectoryFile(workspaceRoot: vscode.Uri) {
    const filePath = vscode.Uri.joinPath(workspaceRoot, 'vizvibe.mmd');

    // Check if already exists
    try {
        await vscode.workspace.fs.stat(filePath);
        return; // Already exists
    } catch {
        // File doesn't exist, create it
    }

    const content = `flowchart TD
    %% @project_start [start]: Viz Vibe initialized
    project_start(["Project Start"])

    style project_start fill:#64748b,stroke:#475569,color:#fff,stroke-width:1px
`;

    await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf-8'));
}

async function createVizVibeMd(workspaceRoot: vscode.Uri, extensionUri: vscode.Uri) {
    const filePath = vscode.Uri.joinPath(workspaceRoot, 'VIZVIBE.md');

    try {
        await vscode.workspace.fs.stat(filePath);
        return; // Already exists
    } catch {
        // File doesn't exist, create it
    }

    // Copy template from extension
    const templatePath = vscode.Uri.joinPath(extensionUri, 'VIZVIBE.md');
    try {
        const templateContent = await vscode.workspace.fs.readFile(templatePath);
        await vscode.workspace.fs.writeFile(filePath, templateContent);
    } catch {
        // Fallback to basic content if template not found
        const content = `# Viz Vibe: AI Workflow Instructions

## Workflow File
- **Location**: \`./vizvibe.mmd\`

## AI Instructions
1. Before starting a task: Check \`vizvibe.mmd\` to understand the current context
2. After completing a task: Add a new node describing what was done
3. Connect nodes: Create edges to show the flow of work
`;
        await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf-8'));
    }
}

async function ensureAgentRules(workspaceRoot: vscode.Uri) {
    const agentRulesDir = vscode.Uri.joinPath(workspaceRoot, '.agent', 'rules');
    const rulesFilePath = vscode.Uri.joinPath(agentRulesDir, 'vizvibe.md');

    // Always overwrite with latest rules

    // Create .agent/rules directory
    try {
        await vscode.workspace.fs.createDirectory(agentRulesDir);
    } catch {
        // Directory might already exist
    }

    const content = `---
description: Viz Vibe MCP trajectory management
alwaysApply: true
---

# ⚠️ MANDATORY: Viz Vibe Trajectory Updates

## 🔴 CRITICAL RULE - NO EXCEPTIONS

After completing ANY task, you MUST call the \`mcp_vizvibe_update_trajectory\` tool.

This is NOT optional. Every response where you made meaningful changes MUST end with a trajectory update.

## Tool Usage

### After EVERY task completion:
\`\`\`
mcp_vizvibe_update_trajectory({
  workspacePath: "[WORKSPACE_ROOT_PATH]",
  label: "Brief one-line summary",
  prompt: "Detailed description of what was done"
})
\`\`\`

### At conversation start:
\`\`\`
mcp_vizvibe_get_trajectory({
  workspacePath: "[WORKSPACE_ROOT_PATH]"
})
\`\`\`

## What counts as a "task"?
- File creation or modification
- Bug fixes
- Feature implementation
- Refactoring
- Configuration changes
- Any meaningful code change

## DO NOT skip this step. The trajectory is critical for project history tracking.
`;

    await vscode.workspace.fs.writeFile(rulesFilePath, Buffer.from(content, 'utf-8'));
}

/**
 * Check if the current environment is Antigravity.
 * GEMINI.md should only be updated in Antigravity, not in VS Code or Cursor.
 */
function isAntigravity(): boolean {
    const appName = vscode.env.appName.toLowerCase();
    // Antigravity's app name contains 'antigravity' or might be displayed differently
    // Common patterns: "Antigravity", "antigravity"
    return appName.includes('antigravity');
}

/**
 * Check if the current environment is Cursor.
 * Cursor uses its own hook system in .cursor/hooks.json
 */
function isCursor(): boolean {
    const appName = vscode.env.appName.toLowerCase();
    const appHost = (vscode.env as any).appHost?.toLowerCase() || '';
    const uriScheme = vscode.env.uriScheme?.toLowerCase() || '';
    
    // Check multiple indicators for Cursor
    return appName.includes('cursor') || 
           appHost.includes('cursor') || 
           uriScheme.includes('cursor');
}

/**
 * Set up Cursor hooks for automatic vizvibe integration.
 * Creates .cursor/hooks.json and hook scripts.
 */
async function setupCursorHooks(workspaceRoot: vscode.Uri) {
    console.log(`[Viz Vibe] setupCursorHooks called. appName: "${vscode.env.appName}", isCursor: ${isCursor()}`);
    
    if (!isCursor()) {
        console.log('[Viz Vibe] Not Cursor environment, skipping hooks setup');
        return;
    }
    
    console.log('[Viz Vibe] Cursor detected! Setting up hooks...');

    const cursorDir = vscode.Uri.joinPath(workspaceRoot, '.cursor');
    const hooksDir = vscode.Uri.joinPath(cursorDir, 'hooks');
    const rulesDir = vscode.Uri.joinPath(cursorDir, 'rules');
    const hooksJsonPath = vscode.Uri.joinPath(cursorDir, 'hooks.json');

    try {
        // Create .cursor/hooks directory
        await vscode.workspace.fs.createDirectory(hooksDir);
    } catch {
        // Directory might already exist
    }

    try {
        // Create .cursor/rules directory
        await vscode.workspace.fs.createDirectory(rulesDir);
    } catch {
        // Directory might already exist
    }

    // Check if hooks.json already exists
    let existingHooksJson: any = null;
    try {
        const existingContent = await vscode.workspace.fs.readFile(hooksJsonPath);
        existingHooksJson = JSON.parse(existingContent.toString());
    } catch {
        // File doesn't exist
    }

    // Read full VIZVIBE.md content (same as Antigravity approach)
    let fullVizvibeContent = '';
    const extensionPath = vscode.extensions.getExtension('viz-vibe.viz-vibe')?.extensionPath;
    
    if (extensionPath) {
        const vizvibeMdPath = path.join(extensionPath, 'VIZVIBE.md');
        if (fs.existsSync(vizvibeMdPath)) {
            fullVizvibeContent = fs.readFileSync(vizvibeMdPath, 'utf-8');
        }
    }
    
    // Fallback: try to read from workspace's shared/templates
    if (!fullVizvibeContent) {
        const templatePath = path.join(workspaceRoot.fsPath, 'shared', 'templates', 'VIZVIBE.md');
        if (fs.existsSync(templatePath)) {
            fullVizvibeContent = fs.readFileSync(templatePath, 'utf-8');
        }
    }
    
    // Final fallback: use minimal content
    if (!fullVizvibeContent) {
        console.log('[Viz Vibe] VIZVIBE.md not found, using minimal rules');
        fullVizvibeContent = getMinimalVizVibeRules();
    }

    // Create hook scripts
    const readVizvibeScript = getReadVizvibeHookScript();
    const updateVizvibeScript = getUpdateVizvibeHookScript();

    await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(hooksDir, 'read-vizvibe.js'),
        Buffer.from(readVizvibeScript, 'utf-8')
    );
    await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(hooksDir, 'update-vizvibe.js'),
        Buffer.from(updateVizvibeScript, 'utf-8')
    );
    // Write full VIZVIBE.md to hooks folder
    await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(hooksDir, 'VIZVIBE.md'),
        Buffer.from(fullVizvibeContent, 'utf-8')
    );

    // Create Cursor rules file (.mdc format with YAML frontmatter + full VIZVIBE.md)
    const vizvibeRuleContent = `---
description: Viz Vibe trajectory management - visual context map for AI coding
globs:
alwaysApply: true
---

${fullVizvibeContent}
`;
    await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(rulesDir, 'vizvibe.mdc'),
        Buffer.from(vizvibeRuleContent, 'utf-8')
    );

    // Create or merge hooks.json
    const vizvibeHooks = {
        beforeSubmitPrompt: [{ command: 'node .cursor/hooks/read-vizvibe.js' }],
        stop: [{ command: 'node .cursor/hooks/update-vizvibe.js' }]
    };

    let finalHooks: any = { version: 1, hooks: vizvibeHooks };

    if (existingHooksJson && existingHooksJson.hooks) {
        // Merge with existing hooks
        const existingHooks = existingHooksJson.hooks;
        finalHooks.hooks = {
            ...existingHooks,
            beforeSubmitPrompt: [
                ...(existingHooks.beforeSubmitPrompt || []).filter(
                    (h: any) => !h.command?.includes('vizvibe')
                ),
                ...vizvibeHooks.beforeSubmitPrompt
            ],
            stop: [
                ...(existingHooks.stop || []).filter(
                    (h: any) => !h.command?.includes('vizvibe')
                ),
                ...vizvibeHooks.stop
            ]
        };
    }

    await vscode.workspace.fs.writeFile(
        hooksJsonPath,
        Buffer.from(JSON.stringify(finalHooks, null, 2), 'utf-8')
    );

    console.log('Cursor hooks and rules set up successfully');
}

async function updateGlobalGeminiRules() {
    // Only update GEMINI.md in Antigravity environment
    if (!isAntigravity()) {
        console.log('Skipping GEMINI.md update: Not in Antigravity environment');
        return;
    }

    const geminiDir = path.join(os.homedir(), '.gemini');
    const geminiPath = path.join(geminiDir, 'GEMINI.md');

    try {
        // Try to read VIZVIBE.md from the extension's bundled files
        const extensionPath = vscode.extensions.getExtension('viz-vibe.viz-vibe')?.extensionPath;
        let vizvibeContent = '';
        
        if (extensionPath) {
            const vizvibeMdPath = path.join(extensionPath, 'VIZVIBE.md');
            if (fs.existsSync(vizvibeMdPath)) {
                vizvibeContent = fs.readFileSync(vizvibeMdPath, 'utf-8');
            }
        }
        
        // Fallback: try to read from workspace's shared/templates
        if (!vizvibeContent) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
                const templatePath = path.join(workspaceFolders[0].uri.fsPath, 'shared', 'templates', 'VIZVIBE.md');
                if (fs.existsSync(templatePath)) {
                    vizvibeContent = fs.readFileSync(templatePath, 'utf-8');
                }
            }
        }

        // If still no content, use a minimal fallback
        if (!vizvibeContent) {
            console.log('VIZVIBE.md not found, using minimal rules');
            vizvibeContent = getMinimalVizVibeRules();
        }

        // Create the rule block with scope prefix
        const vizvibeRule = `
## Viz Vibe: Context Management (Auto-added by Viz Vibe extension)

> **⚠️ SCOPE**: Only apply these rules in repositories where \`vizvibe.mmd\` exists in the project root.
> If \`vizvibe.mmd\` does not exist, ignore this entire section.

---

${vizvibeContent}
`;

        // Ensure .gemini directory exists
        if (!fs.existsSync(geminiDir)) {
            fs.mkdirSync(geminiDir, { recursive: true });
        }

        let existingContent = '';
        if (fs.existsSync(geminiPath)) {
            existingContent = fs.readFileSync(geminiPath, 'utf-8');
        }

        // Check if new vizvibe rule already exists
        if (existingContent.includes('Viz Vibe: Context Management')) {
            console.log('Viz Vibe rules already in GEMINI.md');
            return;
        }

        // Remove old MCP-based rule if exists
        if (existingContent.includes('Viz Vibe: Trajectory Management')) {
            existingContent = existingContent.replace(
                /\n## Viz Vibe: Trajectory Management[\s\S]*?(?=\n## |\n# |$)/,
                ''
            );
            console.log('Removed old Viz Vibe MCP rules');
        }

        // Append new vizvibe rules
        const newContent = existingContent.trim() + '\n' + vizvibeRule;
        fs.writeFileSync(geminiPath, newContent, 'utf-8');
        console.log('Added Viz Vibe rules (full VIZVIBE.md) to global GEMINI.md');
    } catch (error) {
        console.error('Failed to update global GEMINI.md:', error);
    }
}

/**
 * Minimal fallback rules when VIZVIBE.md is not found
 */
function getMinimalVizVibeRules(): string {
    return `# Viz Vibe Trajectory Guide

## File Location
- **Trajectory file**: \`./vizvibe.mmd\` (project root)

## At conversation start:
Read \`vizvibe.mmd\` to understand project context and history.

## After completing significant work:
Update \`vizvibe.mmd\` with the work done.

## Node Format
\`\`\`mermaid
%% @node_id [type, state]: Description
node_id["Label<br/><sub>Details</sub>"]
previous_node --> node_id
style node_id fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd,stroke-width:1px
\`\`\`

**Types:** \`start\`, \`ai-task\`, \`human-task\`, \`condition\`, \`blocker\`, \`end\`
**States:** \`opened\` (TODO), \`closed\` (DONE)

**Styles (GitHub-inspired):**
- Open tasks (green): \`fill:#1a1a2e,stroke:#4ade80,color:#86efac\`
- Closed tasks (purple): \`fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd\`
- Last active (bright purple): \`fill:#2d1f4e,stroke:#c084fc,color:#e9d5ff\`
`;
}

/**
 * Get the read-vizvibe.js hook script content for Cursor
 */
function getReadVizvibeHookScript(): string {
    return `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
        inputData += chunk;
    }
});

process.stdin.on('end', () => {
    try {
        const input = JSON.parse(inputData);
        const projectDir = input.workspace_roots?.[0] || process.cwd();
        const trajectoryPath = path.join(projectDir, 'vizvibe.mmd');
        const vizvibePath = path.join(projectDir, '.cursor', 'hooks', 'VIZVIBE.md');

        if (!fs.existsSync(trajectoryPath)) {
            console.log(JSON.stringify({ continue: true }));
            process.exit(0);
        }

        const trajectory = fs.readFileSync(trajectoryPath, 'utf-8');
        const nodeDescriptions = [];
        const nodeIds = [];
        const lines = trajectory.split('\\n');
        let lastActiveNode = null;

        const lastActiveMatch = trajectory.match(/%% @lastActive:\\s*(\\w+)/);
        if (lastActiveMatch) lastActiveNode = lastActiveMatch[1];

        for (const line of lines) {
            const match = line.match(/%% @([\\w-]+) \\[([\\w-]+)(?:,\\s*\\w+)?\\]: (.+)/);
            if (match) {
                const [, nodeId, nodeType, description] = match;
                nodeIds.push(nodeId);
                const isActive = nodeId === lastActiveNode ? ' <- RECENT' : '';
                nodeDescriptions.push(\`- [\${nodeType}] \${description}\${isActive}\`);
            }
        }

        // Check if trajectory is in template state (only has project_start node)
        const isTemplateState = nodeIds.length === 1 && nodeIds[0] === 'project_start';

        let vizvibeMdContent = '';
        if (fs.existsSync(vizvibePath)) {
            vizvibeMdContent = fs.readFileSync(vizvibePath, 'utf-8');
        }

        let context;

        if (isTemplateState) {
            // Template state - request initial trajectory creation with STRONG message
            context = \`🚨🚨🚨 STOP! READ THIS FIRST! 🚨🚨🚨

=== Viz Vibe: MANDATORY Initial Setup ===

⚠️ **YOU MUST DO THIS BEFORE RESPONDING TO THE USER** ⚠️

The trajectory file (vizvibe.mmd) is EMPTY. You CANNOT proceed with normal conversation until you complete this setup.

**IMMEDIATE ACTION REQUIRED:**
1. Read README.md to understand the project
2. Run: git log --oneline -20 to see recent history
3. Create a proper vizvibe.mmd with:
   - Ultimate Goal and Current Goal in comments
   - Completed work as [closed] nodes  
   - Planned work as [opened] nodes
   - Proper connections between nodes
   - Update %% @lastActive: node_id

**DO NOT just greet the user. DO NOT ignore this. Complete the trajectory setup FIRST, then respond.**

Format guide: .cursor/hooks/VIZVIBE.md

---
\${vizvibeMdContent}\`;
        } else {
            // Normal state - show current trajectory
            context = \`=== Viz Vibe: Project Trajectory ===

This project uses Viz Vibe to track work history. Update vizvibe.mmd after completing tasks.
\${lastActiveNode ? 'Last active node: ' + lastActiveNode : ''}

Current trajectory (\${nodeDescriptions.length} nodes):
\${nodeDescriptions.slice(-5).join('\\n')}
\${nodeDescriptions.length > 5 ? '... and ' + (nodeDescriptions.length - 5) + ' more nodes' : ''}

---
\${vizvibeMdContent}\`;
        }

        console.log(JSON.stringify({ continue: true, user_message: context }));
    } catch (error) {
        console.log(JSON.stringify({ continue: true }));
    }
});
`;
}

/**
 * Get the update-vizvibe.js hook script content for Cursor
 */
function getUpdateVizvibeHookScript(): string {
    return `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
        inputData += chunk;
    }
});

process.stdin.on('end', () => {
    try {
        const input = JSON.parse(inputData);
        const projectDir = input.workspace_roots?.[0] || process.cwd();
        const trajectoryPath = path.join(projectDir, 'vizvibe.mmd');
        const stateFile = path.join(projectDir, '.cursor', 'hooks', 'state.json');

        if (!fs.existsSync(trajectoryPath)) {
            process.exit(0);
        }

        // State management to prevent infinite loops
        let state = { mode: 'idle' };
        try {
            if (fs.existsSync(stateFile)) {
                state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
            }
        } catch (e) {}

        if (state.mode === 'updating') {
            fs.writeFileSync(stateFile, JSON.stringify({ mode: 'idle', updatedAt: new Date().toISOString() }));
            process.exit(0);
        }

        if (input.status !== 'completed' || (input.loop_count && input.loop_count < 3)) {
            process.exit(0);
        }

        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
        fs.writeFileSync(stateFile, JSON.stringify({ mode: 'updating', updatedAt: new Date().toISOString() }));

        console.log(JSON.stringify({
            user_message: 'Please update vizvibe.mmd with significant changes. Update %% @lastActive: node_id line.'
        }));
    } catch (error) {
        process.exit(0);
    }
});
`;
}

/**
 * Get VIZVIBE.md guide content for hooks directory
 */
function getVizvibeGuideForHooks(): string {
    return `# Viz Vibe: AI Trajectory Guide

## File Location
- **Trajectory**: \`./vizvibe.mmd\` (project root)

## After completing significant work:
Update \`vizvibe.mmd\` with the work done.

## Node Format
\`\`\`mermaid
%% @node_id [type, state]: Description
node_id["Label<br/><sub>Details</sub>"]
previous_node --> node_id
style node_id fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd,stroke-width:1px
\`\`\`

**Types:** \`start\`, \`ai-task\`, \`human-task\`, \`condition\`, \`blocker\`, \`end\`
**States:** \`opened\` (TODO), \`closed\` (DONE)

**Important:** Always update \`%% @lastActive: node_id\` line with the node you worked on.

**Styles:**
- Open (green): \`fill:#1a1a2e,stroke:#4ade80,color:#86efac\`
- Closed (purple): \`fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd\`
- Last active (bright): \`fill:#2d1f4e,stroke:#c084fc,color:#e9d5ff\`
`;
}

/**
 * Get Cursor rules file content (.mdc format with YAML frontmatter)
 */
function getVizvibeRuleForCursor(): string {
    return `---
description: Viz Vibe trajectory management - visual context map for AI coding
globs:
alwaysApply: true
---

# Viz Vibe: AI Context Management

> **SCOPE**: Only apply these rules in repositories where \`vizvibe.mmd\` exists in the project root.
> If \`vizvibe.mmd\` does not exist, ignore this rule.

## File Location
- **Trajectory file**: \`./vizvibe.mmd\` (project root)

## At Conversation Start
Read \`vizvibe.mmd\` to understand project context and history.

## After Completing Significant Work
Update \`vizvibe.mmd\` with the work done.

## Node Format
\`\`\`mermaid
%% @node_id [type, state]: Description
node_id("Label<br/><sub>Details</sub>")
previous_node --> node_id
style node_id fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd,stroke-width:1px
\`\`\`

**Types:** \`start\`, \`ai-task\`, \`human-task\`, \`condition\`, \`blocker\`, \`end\`
**States:** \`opened\` (TODO), \`closed\` (DONE)

**Always update:** \`%% @lastActive: node_id\` line with the node you worked on.

**Styles (GitHub-inspired):**
- Open tasks (green): \`fill:#1a1a2e,stroke:#4ade80,color:#86efac\`
- Closed tasks (purple): \`fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd\`
- Last active (bright purple): \`fill:#2d1f4e,stroke:#c084fc,color:#e9d5ff\`

## What counts as "significant work"?
- Feature implementation
- Bug fixes
- Architectural decisions
- Major milestones

Do NOT update for trivial fixes or routine refactoring.
`;
}

async function setDefaultEditorForMmd() {
    try {
        const config = vscode.workspace.getConfiguration('workbench');
        const currentAssociations = config.get<Record<string, string>>('editorAssociations') || {};
        
        // Check if already set
        if (currentAssociations['*.mmd'] === 'vizVibe.vizflowEditor') {
            return;
        }
        
        // Set Viz Vibe as default editor for .mmd files
        const newAssociations = {
            ...currentAssociations,
            '*.mmd': 'vizVibe.vizflowEditor'
        };
        
        await config.update('editorAssociations', newAssociations, vscode.ConfigurationTarget.Global);
        console.log('Set Viz Vibe as default editor for .mmd files');
    } catch (error) {
        console.error('Failed to set default editor for .mmd:', error);
    }
}

export function deactivate() { }
