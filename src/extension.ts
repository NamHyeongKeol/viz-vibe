import * as vscode from 'vscode';
import { WorkflowEditorProvider } from './WorkflowEditorProvider';
import { VizFlowEditorProvider } from './VizFlowEditorProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Viz Vibe extension is now active!');

    // Register Custom Editor for .vizflow files (opens graph in main editor area)
    context.subscriptions.push(VizFlowEditorProvider.register(context));

    // Register the Workflow Editor Provider for sidebar
    const workflowEditorProvider = new WorkflowEditorProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'vizVibe.workflowView',
            workflowEditorProvider
        )
    );

    // Register command to open workflow in a panel
    context.subscriptions.push(
        vscode.commands.registerCommand('vizVibe.openWorkflow', () => {
            WorkflowPanel.createOrShow(context.extensionUri);
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

    // Watch for .vizflow file changes
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.vizflow');

    fileWatcher.onDidChange((uri) => {
        WorkflowPanel.updateFromFile(uri);
    });

    context.subscriptions.push(fileWatcher);
}

export function deactivate() { }

/**
 * Workflow Panel - Opens the graph editor in the main editor area
 */
class WorkflowPanel {
    public static currentPanel: WorkflowPanel | undefined;
    private static readonly viewType = 'vizVibeWorkflow';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.ViewColumn.Beside;

        if (WorkflowPanel.currentPanel) {
            WorkflowPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            WorkflowPanel.viewType,
            'Viz Vibe Workflow',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist')]
            }
        );

        WorkflowPanel.currentPanel = new WorkflowPanel(panel, extensionUri);
    }

    public static updateFromFile(uri: vscode.Uri) {
        if (WorkflowPanel.currentPanel) {
            vscode.workspace.fs.readFile(uri).then((content) => {
                try {
                    const workflow = JSON.parse(content.toString());
                    WorkflowPanel.currentPanel?._panel.webview.postMessage({
                        type: 'updateWorkflow',
                        workflow
                    });
                } catch (e) {
                    console.error('Failed to parse workflow file:', e);
                }
            });
        }
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'saveWorkflow':
                        await this._saveWorkflow(message.workflow);
                        break;
                    case 'info':
                        vscode.window.showInformationMessage(message.text);
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(message.text);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private async _saveWorkflow(workflow: object) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.fileName.endsWith('.vizflow')) {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                activeEditor.document.positionAt(0),
                activeEditor.document.positionAt(activeEditor.document.getText().length)
            );
            edit.replace(activeEditor.document.uri, fullRange, JSON.stringify(workflow, null, 2));
            await vscode.workspace.applyEdit(edit);
            await activeEditor.document.save();
        }
    }

    public dispose() {
        WorkflowPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'Viz Vibe Workflow';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'assets', 'index.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'assets', 'index.css')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
      <link href="${styleUri}" rel="stylesheet">
      <title>Viz Vibe Workflow</title>
    </head>
    <body>
      <div id="root"></div>
      <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
    </body>
    </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
