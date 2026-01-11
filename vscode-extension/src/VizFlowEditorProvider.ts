import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class VizFlowEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'vizVibe.vizflowEditor';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      VizFlowEditorProvider.viewType,
      new VizFlowEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) { }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtmlForWebview();

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'update') {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), message.mermaidCode);
        await vscode.workspace.applyEdit(edit);
      }
    });

    // Send current content to webview
    const updateWebview = () => {
      const mermaidCode = document.getText();
      webviewPanel.webview.postMessage({ type: 'load', mermaidCode });
    };

    // Watch for document changes
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        updateWebview();
      }
    });

    webviewPanel.onDidDispose(() => changeDocumentSubscription.dispose());
    updateWebview();
  }

  private getHtmlForWebview(): string {
    // esbuild creates index.html with inlined CSS/JS, just read and return it
    const htmlPath = path.join(this.context.extensionPath, 'dist', 'webview', 'index.html');
    
    if (fs.existsSync(htmlPath)) {
      return fs.readFileSync(htmlPath, 'utf8');
    }
    
    // Fallback error message
    return `<!DOCTYPE html>
<html>
<body style="padding:20px;color:#ff6b6b;">
  <h2>⚠️ Webview files not found</h2>
  <p>Please run <code>npm run build</code> from the project root.</p>
  <p>Expected path: ${htmlPath}</p>
</body>
</html>`;
  }
}
