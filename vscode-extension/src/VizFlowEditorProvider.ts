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
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

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

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Get paths to shared webview resources
    // In development: ../shared/webview (relative to vscode-extension)
    // In production: ./shared/webview (copied during build)
    let sharedWebviewPath = path.join(this.context.extensionPath, 'shared', 'webview');
    
    // Fallback to development path if production path doesn't exist
    if (!fs.existsSync(sharedWebviewPath)) {
      sharedWebviewPath = path.join(this.context.extensionPath, '..', 'shared', 'webview');
    }
    
    // Create URIs for webview resources
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(sharedWebviewPath, 'styles.css'))
    );
    const platformUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(sharedWebviewPath, 'platform.js'))
    );
    const appUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(sharedWebviewPath, 'app.js'))
    );

    // Read HTML template
    const htmlTemplatePath = path.join(sharedWebviewPath, 'index.html');
    let html = fs.readFileSync(htmlTemplatePath, 'utf8');

    // Replace placeholders with actual URIs
    html = html.replace('{{stylesUri}}', stylesUri.toString());
    html = html.replace('{{platformUri}}', platformUri.toString());
    html = html.replace('{{appUri}}', appUri.toString());

    return html;
  }
}
