import * as vscode from 'vscode';

/**
 * Custom Editor Provider for .vizflow files
 * Opens graph UI directly in the main editor area instead of JSON text
 */
export class VizFlowEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'vizVibe.vizflowEditor';

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new VizFlowEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(
            VizFlowEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                },
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
        webviewPanel.webview.options = {
            enableScripts: true
        };

        // Initial render
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

        // Handle document changes (from external edits or AI)
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                this.updateWebview(webviewPanel.webview, document);
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'update':
                    await this.updateDocument(document, message.workflow);
                    break;
                case 'ready':
                    this.updateWebview(webviewPanel.webview, document);
                    break;
            }
        });
    }

    private updateWebview(webview: vscode.Webview, document: vscode.TextDocument) {
        try {
            const workflow = JSON.parse(document.getText());
            webview.postMessage({ type: 'loadWorkflow', workflow });
        } catch (e) {
            // Invalid JSON, ignore
        }
    }

    private async updateDocument(document: vscode.TextDocument, workflow: object) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            JSON.stringify(workflow, null, 2)
        );
        await vscode.workspace.applyEdit(edit);
    }

    private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
        const nonce = getNonce();

        let initialWorkflow = { version: '1.0', nodes: [], edges: [] };
        try {
            initialWorkflow = JSON.parse(document.getText());
        } catch (e) {
            // Use default
        }

        return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
      <title>Viz Vibe Workflow</title>
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
          padding: 12px 16px;
          background: var(--vscode-editorWidget-background);
          border-bottom: 1px solid var(--vscode-editorWidget-border);
          align-items: center;
        }

        .toolbar-title {
          font-weight: 600;
          font-size: 14px;
          margin-right: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toolbar-title::before {
          content: '✨';
        }

        .toolbar button {
          padding: 6px 14px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .toolbar button:hover {
          background: var(--vscode-button-hoverBackground);
        }

        .toolbar button.secondary {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }

        .toolbar button.secondary:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }

        .spacer {
          flex: 1;
        }

        .graph-container {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .graph-canvas {
          width: 100%;
          height: 100%;
          position: relative;
          background-image: 
            radial-gradient(circle, var(--vscode-editorLineNumber-foreground) 1px, transparent 1px);
          background-size: 24px 24px;
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
          min-width: 160px;
          padding: 14px 18px;
          background: var(--vscode-editor-background);
          border: 2px solid var(--vscode-focusBorder);
          border-radius: 10px;
          cursor: grab;
          user-select: none;
          transition: box-shadow 0.2s, transform 0.1s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .node:hover {
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
          transform: translateY(-1px);
        }

        .node.selected {
          border-color: #007acc;
          box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.3), 0 6px 20px rgba(0, 0, 0, 0.25);
        }

        .node.dragging {
          cursor: grabbing;
          opacity: 0.9;
          transform: scale(1.02);
          z-index: 1000;
        }

        .node-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .node-type {
          font-size: 10px;
          padding: 3px 8px;
          background: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          border-radius: 4px;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .node-label {
          font-size: 13px;
          font-weight: 500;
        }

        .node-prompt {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
          margin-top: 6px;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Node type colors */
        .node.start { 
          border-left: 5px solid #4CAF50; 
        }
        .node.start .node-type { 
          background: #4CAF50; 
          color: white; 
        }
        
        .node.ai-task { 
          border-left: 5px solid #2196F3; 
        }
        .node.ai-task .node-type { 
          background: #2196F3; 
          color: white; 
        }
        
        .node.condition { 
          border-left: 5px solid #FF9800; 
        }
        .node.condition .node-type { 
          background: #FF9800; 
          color: white; 
        }
        
        .node.end { 
          border-left: 5px solid #f44336; 
        }
        .node.end .node-type { 
          background: #f44336; 
          color: white; 
        }

        /* Connection handles */
        .node::before,
        .node::after {
          content: '';
          position: absolute;
          width: 12px;
          height: 12px;
          background: var(--vscode-focusBorder);
          border-radius: 50%;
          border: 2px solid var(--vscode-editor-background);
        }

        .node::before {
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
        }

        .node::after {
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
        }

        .node.start::before { display: none; }
        .node.end::after { display: none; }

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

        .edge-arrow {
          fill: var(--vscode-focusBorder);
        }

        .status-bar {
          padding: 6px 16px;
          background: var(--vscode-statusBar-background);
          color: var(--vscode-statusBar-foreground);
          font-size: 12px;
          display: flex;
          gap: 24px;
          align-items: center;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #4CAF50;
        }

        /* Mini map hint */
        .help-hint {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="toolbar">
          <span class="toolbar-title">Viz Vibe</span>
          <button onclick="addNode('start')">+ Start</button>
          <button onclick="addNode('ai-task')">+ AI Task</button>
          <button onclick="addNode('condition')">+ Condition</button>
          <button onclick="addNode('end')">+ End</button>
          <span class="spacer"></span>
          <button class="secondary" onclick="deleteSelected()">🗑 Delete</button>
        </div>
        
        <div class="graph-container" id="graph">
          <div class="graph-canvas">
            <svg class="edges-layer" id="edges">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon class="edge-arrow" points="0 0, 10 3.5, 0 7" />
                </marker>
              </defs>
            </svg>
            <div class="nodes-layer" id="nodes"></div>
          </div>
        </div>
        
        <div class="status-bar">
          <div class="status-item">
            <span class="status-dot"></span>
            <span>Connected</span>
          </div>
          <span id="nodeCount">Nodes: 0</span>
          <span id="edgeCount">Edges: 0</span>
          <span class="spacer"></span>
          <span class="help-hint">Drag nodes to reposition • Click to select • Changes auto-save</span>
        </div>
      </div>

      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        let workflow = ${JSON.stringify(initialWorkflow)};
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
          }
        });
        
        // Add a new node
        function addNode(type) {
          const id = 'node_' + Date.now();
          const offset = workflow.nodes.length * 20;
          const node = {
            id,
            type,
            position: { x: 200 + offset, y: 100 + offset },
            data: { 
              label: type === 'ai-task' ? 'AI Task' : 
                     type === 'condition' ? 'Condition' :
                     type === 'start' ? 'Start' : 'End'
            }
          };
          
          if (type === 'ai-task') {
            node.data.prompt = 'Describe the AI task here...';
          }
          
          workflow.nodes.push(node);
          render();
          notifyChange();
        }
        
        function deleteSelected() {
          if (!selectedNode) return;
          
          workflow.nodes = workflow.nodes.filter(n => n.id !== selectedNode);
          workflow.edges = workflow.edges.filter(e => 
            e.source !== selectedNode && e.target !== selectedNode
          );
          selectedNode = null;
          render();
          notifyChange();
        }
        
        // Render the graph
        function render() {
          const nodesLayer = document.getElementById('nodes');
          const edgesLayer = document.getElementById('edges');
          
          // Clear nodes
          nodesLayer.innerHTML = '';
          
          // Keep defs, clear paths
          const defs = edgesLayer.querySelector('defs');
          edgesLayer.innerHTML = '';
          edgesLayer.appendChild(defs);
          
          // Render nodes
          workflow.nodes.forEach((node) => {
            const el = document.createElement('div');
            el.className = 'node ' + node.type + (selectedNode === node.id ? ' selected' : '');
            el.style.left = node.position.x + 'px';
            el.style.top = node.position.y + 'px';
            el.dataset.id = node.id;
            
            let content = \`
              <div class="node-header">
                <span class="node-type">\${node.type.replace('-', ' ')}</span>
              </div>
              <div class="node-label">\${node.data.label}</div>
            \`;
            
            if (node.data.prompt) {
              content += \`<div class="node-prompt">\${node.data.prompt}</div>\`;
            }
            
            el.innerHTML = content;
            
            el.addEventListener('mousedown', (e) => startDrag(e, node));
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              selectNode(node.id);
            });
            
            nodesLayer.appendChild(el);
          });
          
          // Render edges
          workflow.edges.forEach((edge) => {
            const sourceNode = workflow.nodes.find(n => n.id === edge.source);
            const targetNode = workflow.nodes.find(n => n.id === edge.target);
            
            if (sourceNode && targetNode) {
              const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              
              // Calculate positions (center bottom to center top)
              const x1 = sourceNode.position.x + 80;
              const y1 = sourceNode.position.y + 60;
              const x2 = targetNode.position.x + 80;
              const y2 = targetNode.position.y;
              
              // Create curved path
              const midY = (y1 + y2) / 2;
              path.setAttribute('d', \`M \${x1} \${y1} C \${x1} \${midY}, \${x2} \${midY}, \${x2} \${y2}\`);
              path.classList.add('edge');
              path.setAttribute('marker-end', 'url(#arrowhead)');
              edgesLayer.appendChild(path);
            }
          });
          
          // Update status
          document.getElementById('nodeCount').textContent = 'Nodes: ' + workflow.nodes.length;
          document.getElementById('edgeCount').textContent = 'Edges: ' + workflow.edges.length;
        }
        
        function selectNode(id) {
          selectedNode = selectedNode === id ? null : id;
          render();
        }
        
        // Click on canvas to deselect
        document.querySelector('.graph-canvas').addEventListener('click', () => {
          selectedNode = null;
          render();
        });
        
        function startDrag(e, node) {
          e.stopPropagation();
          selectNode(node.id);
          
          dragState = {
            node,
            startX: e.clientX,
            startY: e.clientY,
            nodeStartX: node.position.x,
            nodeStartY: node.position.y
          };
          
          const el = document.querySelector(\`[data-id="\${node.id}"]\`);
          if (el) el.classList.add('dragging');
          
          document.addEventListener('mousemove', onDrag);
          document.addEventListener('mouseup', endDrag);
        }
        
        function onDrag(e) {
          if (!dragState) return;
          
          const dx = e.clientX - dragState.startX;
          const dy = e.clientY - dragState.startY;
          
          dragState.node.position.x = Math.max(0, dragState.nodeStartX + dx);
          dragState.node.position.y = Math.max(0, dragState.nodeStartY + dy);
          
          render();
          
          // Re-add dragging class
          const el = document.querySelector(\`[data-id="\${dragState.node.id}"]\`);
          if (el) el.classList.add('dragging');
        }
        
        function endDrag() {
          if (dragState) {
            notifyChange();
          }
          dragState = null;
          document.removeEventListener('mousemove', onDrag);
          document.removeEventListener('mouseup', endDrag);
        }
        
        function notifyChange() {
          vscode.postMessage({ type: 'update', workflow });
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
