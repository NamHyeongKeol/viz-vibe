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
}

async function checkAndPromptInitialization(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspaceRoot = workspaceFolders[0].uri;

    // Check if already initialized in this workspace
    const workspaceKey = `${VIZVIBE_INITIALIZED_KEY}.${workspaceRoot.fsPath}`;
    const alreadyAsked = context.globalState.get<boolean>(workspaceKey);
    if (alreadyAsked) return;

    // Check if .mmd file already exists
    const mmdFiles = await vscode.workspace.findFiles('**/*.mmd', '**/node_modules/**', 1);
    if (mmdFiles.length > 0) {
        // Already has mmd, ensure global rules exist
        await updateGlobalGeminiRules();
        return;
    }

    // Show prompt
    const selection = await vscode.window.showInformationMessage(
        '🚀 Would you like to set up Viz Vibe for this project?\n\nAI will automatically record work history in a graph.',
        'Yes',
        'No',
        'Don\'t ask again'
    );

    if (selection === 'Yes') {
        await initializeVizVibe(context, false);
    } else if (selection === 'Don\'t ask again') {
        await context.globalState.update(workspaceKey, true);
    }
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

        // 2. Update global ~/.gemini/GEMINI.md with MCP rules
        await updateGlobalGeminiRules();

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
                const doc = await vscode.workspace.openTextDocument(trajectoryUri);
                await vscode.window.showTextDocument(doc);
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

async function updateGlobalGeminiRules() {
    const geminiDir = path.join(os.homedir(), '.gemini');
    const geminiPath = path.join(geminiDir, 'GEMINI.md');

    const vizvibeRule = `
## Viz Vibe: Context Management (Auto-added by Viz Vibe extension)

> **SCOPE**: Only apply these rules in repositories where \`vizvibe.mmd\` exists in the project root.

### File Location
- **Trajectory file**: \`./vizvibe.mmd\` (project root)

### At conversation start:
Read \`vizvibe.mmd\` to understand project context and history.

### After completing significant work:
Update \`vizvibe.mmd\` with the work done.

**When to update:**
- Major milestone completed
- New direction/approach decided
- Blocker discovered
- Future work planned

**Skip updates for:** trivial fixes, routine tasks, minor refactoring.

### Node Format

Each node needs: metadata comment, node definition, connection, and style.

\`\`\`mermaid
%% @node_id [type, state]: Description
node_id["Label<br/><sub>Details</sub>"]
previous_node --> node_id
style node_id fill:#334155,stroke:#475569,color:#f8fafc,stroke-width:1px
\`\`\`

**Types:** \`start\`, \`ai-task\`, \`human-task\`, \`condition\`, \`blocker\`, \`end\`
**States:** \`opened\` (TODO), \`closed\` (DONE)

**Styles:**
- Start: \`fill:#64748b,stroke:#475569,color:#fff\`
- Closed task: \`fill:#334155,stroke:#475569,color:#f8fafc\`
- Opened task: \`fill:#1e293b,stroke:#f59e0b,color:#fbbf24\`
- Blocker: \`fill:#450a0a,stroke:#dc2626,color:#fca5a5\`

### Graph Principles
- Connect dependent tasks sequentially (A --> B)
- Branch independent tasks from same parent (parent --> A, parent --> B)
- Use dashed lines for future goals (\`-.->\`)
- Keep it high-level - this is a context map, not a changelog
`;

    try {
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
        console.log('Added Viz Vibe rules to global GEMINI.md');
    } catch (error) {
        console.error('Failed to update global GEMINI.md:', error);
    }
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
