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
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: var(--vscode-font-family);
                    background: var(--vscode-editor-background); 
                    color: var(--vscode-editor-foreground);
                    height: 100vh; overflow: hidden;
                    display: flex; flex-direction: column;
                }

                .toolbar {
                    display: flex; gap: 8px; padding: 12px 16px;
                    background: var(--vscode-editorWidget-background);
                    border-bottom: 1px solid var(--vscode-editorWidget-border);
                    align-items: center; z-index: 100;
                }
                .toolbar-title { font-weight: 600; font-size: 14px; margin-right: 16px; }
                .toolbar-title::before { content: '✨ '; }
                .toolbar button {
                    padding: 6px 14px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none; border-radius: 4px; cursor: pointer;
                    font-size: 12px; font-weight: 500;
                }
                .toolbar button:hover { background: var(--vscode-button-hoverBackground); }
                .toolbar button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
                .spacer { flex: 1; }

                #graph-container { 
                    flex: 1; position: relative; overflow: hidden; cursor: grab;
                    background-image: radial-gradient(circle, var(--vscode-editorLineNumber-foreground) 0.5px, transparent 0.5px);
                    background-size: 24px 24px;
                }
                #canvas { position: absolute; transform-origin: 0 0; width: 10000px; height: 10000px; }

                .node {
                    position: absolute; min-width: 160px; padding: 14px 18px;
                    background: var(--vscode-editor-background);
                    border: 2px solid var(--vscode-focusBorder);
                    border-radius: 10px; cursor: grab; user-select: none;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    pointer-events: auto; z-index: 10;
                }
                .node:hover { box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25); }
                .node.selected { border-color: #007acc; box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.3); }

                .node-type {
                    font-size: 10px; padding: 3px 8px;
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    border-radius: 4px; text-transform: uppercase;
                    font-weight: 600; letter-spacing: 0.5px;
                    display: inline-block; margin-bottom: 6px;
                }
                .node-label { font-size: 13px; font-weight: 500; }
                .node-prompt { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 6px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

                .node.start { border-left: 5px solid #4CAF50; }
                .node.start .node-type { background: #4CAF50; color: white; }
                .node.ai-task { border-left: 5px solid #2196F3; }
                .node.ai-task .node-type { background: #2196F3; color: white; }
                .node.condition { border-left: 5px solid #FF9800; }
                .node.condition .node-type { background: #FF9800; color: white; }
                .node.end { border-left: 5px solid #f44336; }
                .node.end .node-type { background: #f44336; color: white; }

                .node::before, .node::after {
                    content: ''; position: absolute; width: 12px; height: 12px;
                    background: var(--vscode-focusBorder); border-radius: 50%;
                    border: 2px solid var(--vscode-editor-background);
                }
                .node::before { top: -6px; left: 50%; transform: translateX(-50%); }
                .node::after { bottom: -6px; left: 50%; transform: translateX(-50%); }
                .node.start::before { display: none; }
                .node.end::after { display: none; }

                .edge { stroke: var(--vscode-focusBorder); stroke-width: 2; fill: none; }
                .edge-arrow { fill: var(--vscode-focusBorder); }

                .status-bar {
                    padding: 6px 16px;
                    background: var(--vscode-statusBar-background);
                    color: var(--vscode-statusBar-foreground);
                    font-size: 12px; display: flex; gap: 24px; align-items: center;
                    z-index: 100;
                }
                .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4CAF50; display: inline-block; margin-right: 6px; }
                .help-hint { font-size: 11px; color: var(--vscode-descriptionForeground); }
            </style>
        </head>
        <body>
            <div class="toolbar">
                <span class="toolbar-title">Viz Vibe</span>
                <button onclick="addNode('start')">+ Start</button>
                <button onclick="addNode('ai-task')">+ AI Task</button>
                <button onclick="addNode('condition')">+ Condition</button>
                <button onclick="addNode('end')">+ End</button>
                <span class="spacer"></span>
                <button class="secondary" onclick="deleteSelected()">🗑 Delete</button>
            </div>

            <div id="graph-container">
                <div id="canvas">
                    <svg id="edges" style="width:100%; height:100%; position:absolute; top:0; left:0; pointer-events:none;">
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon class="edge-arrow" points="0 0, 10 3.5, 0 7" />
                            </marker>
                        </defs>
                    </svg>
                    <div id="nodes-layer"></div>
                </div>
            </div>

            <div class="status-bar">
                <span><span class="status-dot"></span>Connected</span>
                <span id="nodeCount">Nodes: 0</span>
                <span id="edgeCount">Edges: 0</span>
                <span id="zoomLevel">Zoom: 100%</span>
                <span class="spacer"></span>
                <span class="help-hint">Drag background to pan • Scroll to zoom • Drag nodes to move</span>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let workflow = { nodes: [], edges: [] };
                let transform = { x: 0, y: 0, k: 1 };
                let selectedId = null;

                function updateTransform() {
                    const canvas = document.getElementById('canvas');
                    const container = document.getElementById('graph-container');
                    canvas.style.transform = "translate(" + transform.x + "px," + transform.y + "px) scale(" + transform.k + ")";
                    container.style.backgroundPosition = transform.x + "px " + transform.y + "px";
                    document.getElementById('zoomLevel').innerText = "Zoom: " + Math.round(transform.k * 100) + "%";
                }

                function render() {
                    const nodesLayer = document.getElementById('nodes-layer');
                    const edgesSvg = document.getElementById('edges');
                    nodesLayer.innerHTML = '';
                    
                    // Clear edges except defs
                    const defs = edgesSvg.querySelector('defs');
                    edgesSvg.innerHTML = '';
                    edgesSvg.appendChild(defs);

                    // Render nodes
                    workflow.nodes.forEach(node => {
                        const el = document.createElement('div');
                        el.className = 'node ' + (node.type || '') + (selectedId === node.id ? ' selected' : '');
                        el.style.left = node.position.x + 'px';
                        el.style.top = node.position.y + 'px';
                        
                        let html = '<span class="node-type">' + (node.type || 'node').replace('-', ' ') + '</span>';
                        html += '<div class="node-label">' + (node.data.label || 'Untitled') + '</div>';
                        if (node.data.prompt) {
                            html += '<div class="node-prompt">' + node.data.prompt + '</div>';
                        }
                        el.innerHTML = html;

                        el.onmousedown = (e) => {
                            e.stopPropagation();
                            selectedId = node.id;
                            render();
                            let startX = e.clientX, startY = e.clientY;
                            let origX = node.position.x, origY = node.position.y;
                            
                            const onMove = (me) => {
                                node.position.x = origX + (me.clientX - startX) / transform.k;
                                node.position.y = origY + (me.clientY - startY) / transform.k;
                                el.style.left = node.position.x + 'px';
                                el.style.top = node.position.y + 'px';
                                renderEdges();
                            };
                            const onUp = () => {
                                window.removeEventListener('mousemove', onMove);
                                window.removeEventListener('mouseup', onUp);
                                vscode.postMessage({ type: 'update', workflow });
                            };
                            window.addEventListener('mousemove', onMove);
                            window.addEventListener('mouseup', onUp);
                        };
                        nodesLayer.appendChild(el);
                    });

                    renderEdges();
                    document.getElementById('nodeCount').innerText = 'Nodes: ' + workflow.nodes.length;
                    document.getElementById('edgeCount').innerText = 'Edges: ' + workflow.edges.length;
                }

                function renderEdges() {
                    const edgesSvg = document.getElementById('edges');
                    const defs = edgesSvg.querySelector('defs');
                    edgesSvg.innerHTML = '';
                    edgesSvg.appendChild(defs);

                    workflow.edges.forEach(edge => {
                        const source = workflow.nodes.find(n => n.id === edge.source);
                        const target = workflow.nodes.find(n => n.id === edge.target);
                        if (source && target) {
                            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            const x1 = source.position.x + 80;
                            const y1 = source.position.y + 60;
                            const x2 = target.position.x + 80;
                            const y2 = target.position.y;
                            const midY = (y1 + y2) / 2;
                            path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + midY + ', ' + x2 + ' ' + midY + ', ' + x2 + ' ' + y2);
                            path.classList.add('edge');
                            path.setAttribute('marker-end', 'url(#arrowhead)');
                            edgesSvg.appendChild(path);
                        }
                    });
                }

                // --- PANNING ---
                const container = document.getElementById('graph-container');
                container.onmousedown = (e) => {
                    if (e.target.closest('.node') || e.target.closest('button')) return;
                    let sx = e.clientX - transform.x;
                    let sy = e.clientY - transform.y;
                    container.style.cursor = 'grabbing';
                    
                    const onMove = (me) => {
                        transform.x = me.clientX - sx;
                        transform.y = me.clientY - sy;
                        updateTransform();
                    };
                    const onUp = () => {
                        container.style.cursor = 'grab';
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                };

                // --- ZOOMING ---
                container.onwheel = (e) => {
                    e.preventDefault();
                    let delta = e.deltaY > 0 ? 0.9 : 1.1;
                    let newK = Math.max(0.1, Math.min(5, transform.k * delta));

                    const rect = container.getBoundingClientRect();
                    const mx = e.clientX - rect.left;
                    const my = e.clientY - rect.top;

                    transform.x = mx - (mx - transform.x) * (newK / transform.k);
                    transform.y = my - (my - transform.y) * (newK / transform.k);
                    transform.k = newK;
                    updateTransform();
                };

                // --- CLICK TO DESELECT ---
                container.onclick = (e) => {
                    if (!e.target.closest('.node')) {
                        selectedId = null;
                        render();
                    }
                };

                // --- MESSAGE HANDLER ---
                window.onmessage = (e) => {
                    if (e.data.type === 'load') {
                        workflow = e.data.workflow;
                        if (!workflow.nodes) workflow.nodes = [];
                        if (!workflow.edges) workflow.edges = [];
                        render();
                    }
                };

                // --- ADD NODE ---
                function addNode(type) {
                    const id = 'node_' + Date.now();
                    const rect = container.getBoundingClientRect();
                    const x = (rect.width / 2 - transform.x) / transform.k - 80;
                    const y = (rect.height / 2 - transform.y) / transform.k - 30;
                    workflow.nodes.push({
                        id, type, position: { x, y },
                        data: { label: type === 'ai-task' ? 'AI Task' : type === 'condition' ? 'Condition' : type === 'start' ? 'Start' : 'End' }
                    });
                    render();
                    vscode.postMessage({ type: 'update', workflow });
                }

                // --- DELETE SELECTED ---
                function deleteSelected() {
                    if (!selectedId) return;
                    workflow.nodes = workflow.nodes.filter(n => n.id !== selectedId);
                    workflow.edges = workflow.edges.filter(e => e.source !== selectedId && e.target !== selectedId);
                    selectedId = null;
                    render();
                    vscode.postMessage({ type: 'update', workflow });
                }

                updateTransform();
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
