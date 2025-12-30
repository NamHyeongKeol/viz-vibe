import * as vscode from 'vscode';

/**
 * Provider for the Workflow Editor webview view in the sidebar
 */
export class WorkflowEditorProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vizVibe.workflowView';
    private _view?: vscode.WebviewView;
    private _currentWorkflow?: object;

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'ready':
                    this._sendCurrentWorkflow();
                    break;
                case 'nodeSelected':
                    vscode.window.showInformationMessage(`Selected node: ${data.nodeId}`);
                    break;
                case 'workflowChanged':
                    this._currentWorkflow = data.workflow;
                    await this._saveToActiveFile(data.workflow);
                    break;
            }
        });

        // Watch for active editor changes
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.fileName.endsWith('.vizflow')) {
                this._loadWorkflowFromEditor(editor);
            }
        });

        // Load initial workflow if a .vizflow file is open
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.fileName.endsWith('.vizflow')) {
            this._loadWorkflowFromEditor(activeEditor);
        }
    }

    private async _loadWorkflowFromEditor(editor: vscode.TextEditor) {
        try {
            const content = editor.document.getText();
            const workflow = JSON.parse(content);
            this._currentWorkflow = workflow;
            this._sendCurrentWorkflow();
        } catch (e) {
            console.error('Failed to parse workflow:', e);
        }
    }

    private _sendCurrentWorkflow() {
        if (this._view && this._currentWorkflow) {
            this._view.webview.postMessage({
                type: 'loadWorkflow',
                workflow: this._currentWorkflow
            });
        }
    }

    private async _saveToActiveFile(workflow: object) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.fileName.endsWith('.vizflow')) {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                activeEditor.document.positionAt(0),
                activeEditor.document.positionAt(activeEditor.document.getText().length)
            );
            edit.replace(
                activeEditor.document.uri,
                fullRange,
                JSON.stringify(workflow, null, 2)
            );
            await vscode.workspace.applyEdit(edit);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();

        // Inline React Flow based graph editor
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' https://unpkg.com;">
      <title>Workflow Editor</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: var(--vscode-font-family);
          background: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
          height: 100vh;
          overflow: hidden;
        }

        .container {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .toolbar {
          display: flex;
          gap: 8px;
          padding: 8px;
          background: var(--vscode-sideBar-background);
          border-bottom: 1px solid var(--vscode-sideBar-border);
        }

        .toolbar button {
          padding: 4px 12px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .toolbar button:hover {
          background: var(--vscode-button-hoverBackground);
        }

        .graph-container {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .graph-canvas {
          width: 100%;
          height: 100%;
          background: 
            linear-gradient(90deg, var(--vscode-editorLineNumber-foreground) 1px, transparent 1px),
            linear-gradient(var(--vscode-editorLineNumber-foreground) 1px, transparent 1px);
          background-size: 20px 20px;
          background-position: center center;
        }

        .nodes-layer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        .node {
          position: absolute;
          min-width: 120px;
          padding: 12px 16px;
          background: var(--vscode-editor-background);
          border: 2px solid var(--vscode-focusBorder);
          border-radius: 8px;
          cursor: grab;
          user-select: none;
          transition: box-shadow 0.2s, transform 0.1s;
        }

        .node:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .node.selected {
          border-color: var(--vscode-inputValidation-infoBorder);
          box-shadow: 0 0 0 3px rgba(0, 120, 212, 0.3);
        }

        .node.dragging {
          cursor: grabbing;
          opacity: 0.8;
          transform: scale(1.02);
        }

        .node-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .node-type {
          font-size: 10px;
          padding: 2px 6px;
          background: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          border-radius: 4px;
        }

        .node.start { border-left: 4px solid #4CAF50; }
        .node.ai-task { border-left: 4px solid #2196F3; }
        .node.condition { border-left: 4px solid #FF9800; }
        .node.end { border-left: 4px solid #f44336; }

        .edges-layer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .edge {
          stroke: var(--vscode-focusBorder);
          stroke-width: 2;
          fill: none;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 16px;
          color: var(--vscode-descriptionForeground);
        }

        .empty-state h3 {
          font-size: 16px;
          font-weight: 600;
        }

        .empty-state p {
          font-size: 13px;
          text-align: center;
          max-width: 200px;
        }

        .status-bar {
          padding: 4px 8px;
          background: var(--vscode-statusBar-background);
          color: var(--vscode-statusBar-foreground);
          font-size: 11px;
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="toolbar">
          <button onclick="addNode('ai-task')">+ AI Task</button>
          <button onclick="addNode('condition')">+ Condition</button>
          <button onclick="addNode('end')">+ End</button>
          <button onclick="saveWorkflow()">💾 Save</button>
        </div>
        
        <div class="graph-container" id="graph">
          <div class="graph-canvas">
            <svg class="edges-layer" id="edges"></svg>
            <div class="nodes-layer" id="nodes"></div>
          </div>
        </div>
        
        <div class="status-bar">
          <span id="nodeCount">Nodes: 0</span>
          <span id="edgeCount">Edges: 0</span>
        </div>
      </div>

      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        let workflow = {
          version: '1.0',
          nodes: [],
          edges: []
        };
        
        let selectedNode = null;
        let dragState = null;
        
        // Initialize
        function init() {
          vscode.postMessage({ type: 'ready' });
          render();
        }
        
        // Handle messages from extension
        window.addEventListener('message', (event) => {
          const message = event.data;
          switch (message.type) {
            case 'loadWorkflow':
              workflow = message.workflow;
              render();
              break;
            case 'updateWorkflow':
              workflow = message.workflow;
              render();
              break;
          }
        });
        
        // Add a new node
        function addNode(type) {
          const id = 'node_' + Date.now();
          const node = {
            id,
            type,
            position: { x: 150 + Math.random() * 100, y: 150 + Math.random() * 100 },
            data: { label: type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ') }
          };
          workflow.nodes.push(node);
          render();
          notifyChange();
        }
        
        // Render the graph
        function render() {
          const nodesLayer = document.getElementById('nodes');
          const edgesLayer = document.getElementById('edges');
          
          // Clear
          nodesLayer.innerHTML = '';
          edgesLayer.innerHTML = '';
          
          if (workflow.nodes.length === 0) {
            nodesLayer.innerHTML = \`
              <div class="empty-state">
                <h3>🎨 Viz Vibe</h3>
                <p>Open a .vizflow file or create a new workflow to get started</p>
              </div>
            \`;
          }
          
          // Render nodes
          workflow.nodes.forEach((node) => {
            const el = document.createElement('div');
            el.className = 'node ' + node.type + (selectedNode === node.id ? ' selected' : '');
            el.style.left = node.position.x + 'px';
            el.style.top = node.position.y + 'px';
            el.dataset.id = node.id;
            
            el.innerHTML = \`
              <div class="node-header">
                <span class="node-type">\${node.type}</span>
              </div>
              <div>\${node.data.label}</div>
            \`;
            
            el.addEventListener('mousedown', (e) => startDrag(e, node));
            el.addEventListener('click', () => selectNode(node.id));
            
            nodesLayer.appendChild(el);
          });
          
          // Render edges
          workflow.edges.forEach((edge) => {
            const sourceNode = workflow.nodes.find(n => n.id === edge.source);
            const targetNode = workflow.nodes.find(n => n.id === edge.target);
            
            if (sourceNode && targetNode) {
              const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              const x1 = sourceNode.position.x + 60;
              const y1 = sourceNode.position.y + 30;
              const x2 = targetNode.position.x + 60;
              const y2 = targetNode.position.y + 30;
              
              const cx = (x1 + x2) / 2;
              path.setAttribute('d', \`M \${x1} \${y1} Q \${cx} \${y1} \${cx} \${(y1+y2)/2} T \${x2} \${y2}\`);
              path.classList.add('edge');
              edgesLayer.appendChild(path);
            }
          });
          
          // Update status
          document.getElementById('nodeCount').textContent = 'Nodes: ' + workflow.nodes.length;
          document.getElementById('edgeCount').textContent = 'Edges: ' + workflow.edges.length;
        }
        
        function selectNode(id) {
          selectedNode = id;
          vscode.postMessage({ type: 'nodeSelected', nodeId: id });
          render();
        }
        
        function startDrag(e, node) {
          dragState = {
            node,
            startX: e.clientX,
            startY: e.clientY,
            nodeStartX: node.position.x,
            nodeStartY: node.position.y
          };
          
          document.addEventListener('mousemove', onDrag);
          document.addEventListener('mouseup', endDrag);
        }
        
        function onDrag(e) {
          if (!dragState) return;
          
          const dx = e.clientX - dragState.startX;
          const dy = e.clientY - dragState.startY;
          
          dragState.node.position.x = dragState.nodeStartX + dx;
          dragState.node.position.y = dragState.nodeStartY + dy;
          
          render();
        }
        
        function endDrag() {
          if (dragState) {
            notifyChange();
          }
          dragState = null;
          document.removeEventListener('mousemove', onDrag);
          document.removeEventListener('mouseup', endDrag);
        }
        
        function saveWorkflow() {
          vscode.postMessage({ type: 'workflowChanged', workflow });
        }
        
        function notifyChange() {
          vscode.postMessage({ type: 'workflowChanged', workflow });
        }
        
        init();
      </script>
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
