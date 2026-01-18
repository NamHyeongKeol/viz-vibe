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

    // Check if Viz Vibe is already set up (v2.0 or legacy)
    const v2TrajectoryPath = vscode.Uri.joinPath(workspaceRoot, '.vizvibe', 'trajectory.mmd');
    const legacyPath = vscode.Uri.joinPath(workspaceRoot, 'vizvibe.mmd');
    
    // Check v2.0 structure first
    try {
        await vscode.workspace.fs.stat(v2TrajectoryPath);
        // v2.0 structure exists
        await updateGlobalGeminiRules();
        return;
    } catch {
        // v2.0 doesn't exist, check legacy
    }
    
    // Check legacy structure
    try {
        await vscode.workspace.fs.stat(legacyPath);
        // legacy exists, ensure global rules exist
        await updateGlobalGeminiRules();
        return;
    } catch {
        // Neither exists, continue to prompt
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
        await setupCursorRules(workspaceRoot);  // Cursor (rules only, no hooks)

        // Mark as initialized
        const workspaceKey = `${VIZVIBE_INITIALIZED_KEY}.${workspaceRoot.fsPath}`;
        await context.globalState.update(workspaceKey, true);

        if (showSuccess) {
            vscode.window.showInformationMessage('✅ Viz Vibe has been set up for this project!');
        } else {
            const openTrajectory = await vscode.window.showInformationMessage(
                '✅ Viz Vibe has been set up for this project!',
                'Open trajectory'
            );
            if (openTrajectory) {
                const trajectoryUri = vscode.Uri.joinPath(workspaceRoot, '.vizvibe', 'trajectory.mmd');
                // Open with Custom Editor (Graph View) directly
                await vscode.commands.executeCommand('vscode.openWith', trajectoryUri, 'vizVibe.vizflowEditor');
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Viz Vibe setup failed: ${error}`);
    }
}

async function createTrajectoryFile(workspaceRoot: vscode.Uri) {
    // v2.0 folder structure
    const vizvibeDir = vscode.Uri.joinPath(workspaceRoot, '.vizvibe');
    const nodesDir = vscode.Uri.joinPath(vizvibeDir, 'nodes');
    const trajectoryPath = vscode.Uri.joinPath(vizvibeDir, 'trajectory.mmd');
    const statePath = vscode.Uri.joinPath(vizvibeDir, 'state.json');

    // Check if already exists (v2.0 or legacy)
    try {
        await vscode.workspace.fs.stat(trajectoryPath);
        return; // v2.0 already exists
    } catch {
        // Check legacy
        try {
            await vscode.workspace.fs.stat(vscode.Uri.joinPath(workspaceRoot, 'vizvibe.mmd'));
            return; // Legacy exists, don't overwrite
        } catch {
            // Neither exists, create v2.0 structure
        }
    }

    // Create directories
    try {
        await vscode.workspace.fs.createDirectory(vizvibeDir);
    } catch {
        // Directory might already exist
    }
    try {
        await vscode.workspace.fs.createDirectory(nodesDir);
    } catch {
        // Directory might already exist
    }

    // Create trajectory.mmd
    const trajectoryContent = `flowchart TD
    %% === PROJECT GOALS ===
    %% Ultimate Goal: [Describe your project's ultimate goal]
    %% Current Goal: [Describe your current focus]
    %% @lastActive: project_start

    %% @project_start [start, closed]
    project_start("Project Start<br/><sub>Viz Vibe initialized<br/>Ready to track trajectory</sub>")

    %% @ultimate_goal [end, opened]
    ultimate_goal("Ultimate Goal<br/><sub>Your project's final<br/>objective goes here</sub>")

    project_start -.-> ultimate_goal

    subgraph recent [RECENT]
        project_start
    end

    %% === STYLES ===
    style project_start fill:#1a1a2e,stroke:#6b7280,color:#9ca3af,stroke-width:1px
    style ultimate_goal fill:#1a1a2e,stroke:#6b7280,color:#9ca3af,stroke-width:1px
    style recent fill:transparent,stroke:#c084fc,color:#c084fc,stroke-width:2px,stroke-dasharray:5 5
`;
    await vscode.workspace.fs.writeFile(trajectoryPath, Buffer.from(trajectoryContent, 'utf-8'));

    // Create state.json
    const stateContent = JSON.stringify({
        version: '2.0',
        createdAt: new Date().toISOString(),
        lastActiveNode: 'project_start'
    }, null, 2);
    await vscode.workspace.fs.writeFile(statePath, Buffer.from(stateContent, 'utf-8'));

    // Add .vizvibe/state.json to .gitignore
    const gitignorePath = vscode.Uri.joinPath(workspaceRoot, '.gitignore');
    try {
        const existingContent = (await vscode.workspace.fs.readFile(gitignorePath)).toString();
        if (!existingContent.includes('.vizvibe/state.json')) {
            const newContent = existingContent.trim() + '\n\n# Viz Vibe runtime state\n.vizvibe/state.json\n';
            await vscode.workspace.fs.writeFile(gitignorePath, Buffer.from(newContent, 'utf-8'));
        }
    } catch {
        // .gitignore doesn't exist, create it
        const content = '# Viz Vibe runtime state\n.vizvibe/state.json\n';
        await vscode.workspace.fs.writeFile(gitignorePath, Buffer.from(content, 'utf-8'));
    }
}

/**
 * Set up Cursor rules for vizvibe integration.
 * Creates .cursor/rules/vizvibe.mdc only (hooks don't work in Cursor).
 */
async function setupCursorRules(workspaceRoot: vscode.Uri) {
    const appName = vscode.env.appName.toLowerCase();
    const appHost = (vscode.env as any).appHost?.toLowerCase() || '';
    const uriScheme = vscode.env.uriScheme?.toLowerCase() || '';
    
    // Check if running in Cursor
    const isCursor = appName.includes('cursor') || 
                     appHost.includes('cursor') || 
                     uriScheme.includes('cursor');
    
    if (!isCursor) {
        console.log('[Viz Vibe] Not Cursor environment, skipping rules setup');
        return;
    }
    
    console.log('[Viz Vibe] Cursor detected! Setting up rules...');

    const cursorDir = vscode.Uri.joinPath(workspaceRoot, '.cursor');
    const rulesDir = vscode.Uri.joinPath(cursorDir, 'rules');

    try {
        await vscode.workspace.fs.createDirectory(rulesDir);
    } catch {
        // Directory might already exist
    }

    // Read full VIZVIBE.md content
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

    console.log('[Viz Vibe] Cursor rules set up successfully');
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
 * Check if the current environment is Antigravity.
 * GEMINI.md should only be updated in Antigravity, not in VS Code or Cursor.
 */
function isAntigravity(): boolean {
    const appName = vscode.env.appName.toLowerCase();
    return appName.includes('antigravity');
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
