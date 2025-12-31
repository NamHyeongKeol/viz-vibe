import * as vscode from 'vscode';
import { VizFlowEditorProvider } from './VizFlowEditorProvider';

const VIZVIBE_INITIALIZED_KEY = 'vizVibe.initialized';

export function activate(context: vscode.ExtensionContext) {
    console.log('Viz Vibe extension is now active!');

    // Register Custom Editor for .vizflow files
    context.subscriptions.push(VizFlowEditorProvider.register(context));

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
                value: 'workflow.vizflow'
            });

            if (fileName) {
                const filePath = vscode.Uri.joinPath(workspaceFolders[0].uri, fileName);
                const defaultContent = JSON.stringify({
                    version: '1.0',
                    nodes: [
                        {
                            id: 'start',
                            type: 'start',
                            position: { x: 100, y: 100 },
                            data: { label: 'Start' }
                        }
                    ],
                    edges: []
                }, null, 2);

                await vscode.workspace.fs.writeFile(filePath, Buffer.from(defaultContent, 'utf-8'));
                const doc = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage(`Created ${fileName}`);
            }
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

    // Check if .vizflow file already exists
    const vizflowFiles = await vscode.workspace.findFiles('**/*.vizflow', '**/node_modules/**', 1);
    if (vizflowFiles.length > 0) {
        // Already has vizflow, ensure rules exist
        await ensureAgentRules(workspaceRoot);
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
        // 1. Create trajectory.vizflow
        await createTrajectoryFile(workspaceRoot);

        // 2. Create VIZVIBE.md
        await createVizVibeMd(workspaceRoot, context.extensionUri);

        // 3. Create .agent/rules/vizvibe.md
        await ensureAgentRules(workspaceRoot);

        // Mark as initialized
        const workspaceKey = `${VIZVIBE_INITIALIZED_KEY}.${workspaceRoot.fsPath}`;
        await context.globalState.update(workspaceKey, true);

        if (showSuccess) {
            vscode.window.showInformationMessage('✅ Viz Vibe has been set up for this project!');
        } else {
            const openTrajectory = await vscode.window.showInformationMessage(
                '✅ Viz Vibe has been set up for this project!',
                'Open trajectory.vizflow'
            );
            if (openTrajectory) {
                const trajectoryUri = vscode.Uri.joinPath(workspaceRoot, 'trajectory.vizflow');
                const doc = await vscode.workspace.openTextDocument(trajectoryUri);
                await vscode.window.showTextDocument(doc);
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Viz Vibe setup failed: ${error}`);
    }
}

async function createTrajectoryFile(workspaceRoot: vscode.Uri) {
    const filePath = vscode.Uri.joinPath(workspaceRoot, 'trajectory.vizflow');

    // Check if already exists
    try {
        await vscode.workspace.fs.stat(filePath);
        return; // Already exists
    } catch {
        // File doesn't exist, create it
    }

    const content = JSON.stringify({
        version: '1.0',
        nodes: [
            {
                id: 'project_start',
                type: 'start',
                position: { x: 300, y: 50 },
                data: {
                    label: 'Project Start',
                    prompt: 'Viz Vibe initialized'
                }
            }
        ],
        edges: []
    }, null, 2);

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
- **Location**: \`./trajectory.vizflow\`

## AI Instructions
1. Before starting a task: Check \`trajectory.vizflow\` to understand the current context
2. After completing a task: Add a new node describing what was done
3. Connect nodes: Create edges to show the flow of work
`;
        await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf-8'));
    }
}

async function ensureAgentRules(workspaceRoot: vscode.Uri) {
    const agentRulesDir = vscode.Uri.joinPath(workspaceRoot, '.agent', 'rules');
    const rulesFilePath = vscode.Uri.joinPath(agentRulesDir, 'vizvibe.md');

    try {
        await vscode.workspace.fs.stat(rulesFilePath);
        return; // Already exists
    } catch {
        // Create directory and file
    }

    // Create .agent/rules directory
    try {
        await vscode.workspace.fs.createDirectory(agentRulesDir);
    } catch {
        // Directory might already exist
    }

    const content = `---
description: Viz Vibe trajectory management rules
alwaysApply: true
---

# Viz Vibe Rules

## Automatic Trajectory Management
When working in this project, always follow these rules:

### After completing any task:
1. Open \`trajectory.vizflow\`
2. Add a new node with:
   - \`type\`: "ai-task"
   - \`label\`: Brief description of what was done
   - \`prompt\`: Detailed explanation
   - \`position\`: Below the last node
3. Add an edge connecting from the previous task to this new node

### Before starting work:
1. Read \`trajectory.vizflow\` to understand the current project state
2. Read \`VIZVIBE.md\` for project-specific instructions

### Node positioning:
- Keep nodes vertically aligned when possible
- Use x: 300 as the center column
- Space nodes 120px apart vertically

## Example node addition:
\`\`\`json
{
  "id": "node_" + timestamp,
  "type": "ai-task",
  "position": { "x": 300, "y": lastY + 120 },
  "data": {
    "label": "Feature: User Authentication",
    "prompt": "Implemented login and signup pages with JWT tokens"
  }
}
\`\`\`
`;

    await vscode.workspace.fs.writeFile(rulesFilePath, Buffer.from(content, 'utf-8'));
}

export function deactivate() { }
