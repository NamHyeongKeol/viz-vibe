import * as vscode from 'vscode';

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
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'update') {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), JSON.stringify(message.workflow, null, 2));
        await vscode.workspace.applyEdit(edit);
      }
    });

    const updateWebview = () => {
      try {
        const workflow = JSON.parse(document.getText());
        webviewPanel.webview.postMessage({ type: 'load', workflow });
      } catch (e) { }
    };

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) updateWebview();
    });

    webviewPanel.onDidDispose(() => changeDocumentSubscription.dispose());
    updateWebview();
  }

  private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
    return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body { background: #1e1e1e; color: white; height: 100vh; margin: 0; display: flex; flex-direction: column; font-family: sans-serif; }
                #status { background: #333; padding: 5px 10px; font-size: 12px; color: #0f0; }
                #canvas-container { flex: 1; position: relative; overflow: hidden; cursor: crosshair; }
                #canvas { position: absolute; transform-origin: 0 0; width: 5000px; height: 5000px; }
                .node { 
                    position: absolute; width: 120px; padding: 10px; background: #2d2d2d; 
                    border: 1px solid #555; border-radius: 4px; pointer-events: auto;
                }
                .node:hover { border-color: #007acc; }
            </style>
        </head>
        <body>
            <div id="status">Status: Initializing... (Try Dragging Background)</div>
            <div id="canvas-container">
                <div id="canvas">
                    <div id="nodes-layer"></div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const status = document.getElementById('status');
                let workflow = { nodes: [] };
                let transform = { x: 0, y: 0, k: 1 };
                
                function update() {
                    const canvas = document.getElementById('canvas');
                    canvas.style.transform = "translate(" + transform.x + "px," + transform.y + "px) scale(" + transform.k + ")";
                    status.innerText = "Zoom: " + Math.round(transform.k * 100) + "% | Pos: " + Math.round(transform.x) + "," + Math.round(transform.y);
                }

                // PANNING
                const container = document.getElementById('canvas-container');
                container.onmousedown = (e) => {
                    if (e.target !== container && e.target.id !== 'canvas') return;
                    let sx = e.clientX - transform.x;
                    let sy = e.clientY - transform.y;
                    status.innerText = "Panning...";
                    
                    window.onmousemove = (me) => {
                        transform.x = me.clientX - sx;
                        transform.y = me.clientY - sy;
                        update();
                    };
                    window.onmouseup = () => {
                        window.onmousemove = null;
                        window.onmouseup = null;
                        update();
                    };
                };

                // ZOOMING
                container.onwheel = (e) => {
                    e.preventDefault();
                    let delta = e.deltaY > 0 ? 0.9 : 1.1;
                    let newK = transform.k * delta;
                    if (newK < 0.1) newK = 0.1;
                    if (newK > 5) newK = 5;

                    let rect = container.getBoundingClientRect();
                    let mx = e.clientX - rect.left;
                    let my = e.clientY - rect.top;

                    transform.x = mx - (mx - transform.x) * (newK / transform.k);
                    transform.y = my - (my - transform.y) * (newK / transform.k);
                    transform.k = newK;
                    update();
                };

                window.onmessage = (e) => {
                    if (e.data.type === 'load') {
                        workflow = e.data.workflow;
                        const layer = document.getElementById('nodes-layer');
                        layer.innerHTML = '';
                        workflow.nodes.forEach(n => {
                            const div = document.createElement('div');
                            div.className = 'node';
                            div.style.left = n.position.x + 'px';
                            div.style.top = n.position.y + 'px';
                            div.innerText = n.data.label;
                            layer.appendChild(div);
                        });
                        status.innerText = "Loaded: " + workflow.nodes.length + " nodes";
                    }
                };

                update();
            </script>
        </body>
        </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
