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
    return `<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
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
            display: flex; gap: 6px; padding: 8px 12px;
            background: var(--vscode-editorWidget-background);
            border-bottom: 1px solid var(--vscode-editorWidget-border);
            align-items: center; z-index: 100;
            flex-wrap: wrap;
        }
        .toolbar-title { font-weight: 600; font-size: 13px; margin-right: 12px; }
        .toolbar-title::before { content: '✨ '; }
        .toolbar button {
            padding: 4px 10px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none; border-radius: 4px; cursor: pointer;
            font-size: 11px; font-weight: 500;
            transition: all 0.15s;
        }
        .toolbar button:hover { background: var(--vscode-button-hoverBackground); }
        .toolbar button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        .toolbar button.danger { background: #dc3545; color: white; }
        .spacer { flex: 1; }
        .toolbar select {
            padding: 4px 8px;
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            font-size: 11px;
        }
        .toolbar-divider {
            width: 1px; height: 20px;
            background: var(--vscode-editorWidget-border);
            margin: 0 6px;
        }

        /* Main container */
        .main-container {
            flex: 1;
            display: flex;
            overflow: hidden;
        }

        /* Graph view */
        #graph-view { 
            flex: 1; position: relative; overflow: hidden;
            cursor: grab;
            background-image: radial-gradient(circle, var(--vscode-editorLineNumber-foreground) 0.5px, transparent 0.5px);
            background-size: 20px 20px;
        }
        #graph-view.grabbing { cursor: grabbing; }

        #canvas-wrapper {
            position: absolute;
            transform-origin: 0 0;
        }

        #mermaid-container {
            background: var(--vscode-editor-background);
            border-radius: 8px;
            padding: 20px;
            display: inline-block;
            border: 1px solid var(--vscode-editorWidget-border);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        /* Source view */
        #source-view {
            flex: 1;
            display: none;
            flex-direction: column;
        }
        #source-view.active { display: flex; }
        #graph-view.hidden { display: none; }

        #source-editor {
            flex: 1;
            width: 100%;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            border: none;
            padding: 16px;
            font-family: 'SF Mono', Monaco, Consolas, monospace;
            font-size: 12px;
            line-height: 1.5;
            resize: none;
            outline: none;
        }

        /* Node hover */
        .node rect, .node polygon, .node circle, .node ellipse {
            cursor: pointer;
            transition: all 0.15s;
        }
        .node:hover rect, .node:hover polygon, .node:hover circle {
            filter: brightness(1.15);
        }

        .status-bar {
            padding: 6px 16px;
            background: var(--vscode-statusBar-background);
            color: var(--vscode-statusBar-foreground);
            font-size: 11px; display: flex; gap: 20px; align-items: center;
            z-index: 100;
        }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4CAF50; display: inline-block; margin-right: 6px; }
        .help-hint { font-size: 10px; color: var(--vscode-descriptionForeground); }

        /* Node info card */
        .info-card {
            position: absolute;
            bottom: 16px; left: 16px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 8px;
            padding: 12px 16px;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 50;
        }
        .info-card h4 {
            margin-bottom: 6px;
            color: var(--vscode-textLink-foreground);
            font-size: 13px;
        }
        .info-card p {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.4;
            white-space: pre-wrap;
        }
        .info-card .close-btn {
            position: absolute; top: 8px; right: 8px;
            background: none; border: none; color: var(--vscode-descriptionForeground);
            cursor: pointer; font-size: 14px;
        }
        .info-card .copy-btn {
            margin-top: 8px;
            padding: 4px 8px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none; border-radius: 4px; cursor: pointer;
            font-size: 10px;
        }
        .info-card .copy-btn:hover { background: var(--vscode-button-hoverBackground); }

        /* Context menu */
        .context-menu {
            position: fixed;
            background: var(--vscode-menu-background);
            border: 1px solid var(--vscode-menu-border);
            border-radius: 6px;
            padding: 4px 0;
            min-width: 160px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            z-index: 1000;
            display: none;
        }
        .context-menu.active { display: block; }
        .context-menu-item {
            padding: 6px 12px;
            font-size: 12px;
            cursor: pointer;
            color: var(--vscode-menu-foreground);
        }
        .context-menu-item:hover {
            background: var(--vscode-menu-selectionBackground);
            color: var(--vscode-menu-selectionForeground);
        }
        .context-menu-divider {
            height: 1px;
            background: var(--vscode-menu-separatorBackground);
            margin: 4px 0;
        }

        /* Toast notification */
        .toast {
            position: fixed;
            bottom: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--vscode-notificationsInfoIcon-foreground);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1001;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .toast.show { opacity: 1; }

        /* Zoom controls */
        .zoom-controls {
            position: absolute;
            bottom: 16px; right: 16px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            z-index: 50;
        }
        .zoom-controls button {
            width: 32px; height: 32px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .zoom-controls button:hover { background: var(--vscode-button-hoverBackground); }
        .zoom-level {
            text-align: center;
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            padding: 4px;
        }

        /* Modal */
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        .modal-overlay.active { display: flex; }
        .modal {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 8px;
            padding: 20px;
            min-width: 400px;
            max-width: 500px;
        }
        .modal h3 { margin-bottom: 16px; font-size: 14px; }
        .modal label {
            display: block;
            font-size: 11px;
            margin-bottom: 4px;
            color: var(--vscode-descriptionForeground);
        }
        .modal input, .modal textarea, .modal select {
            width: 100%;
            padding: 8px 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            margin-bottom: 12px;
            font-size: 12px;
            font-family: inherit;
        }
        .modal textarea { min-height: 80px; resize: vertical; }
        .modal-buttons {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 8px;
        }

        /* View toggle button */
        .view-toggle {
            display: flex;
            background: var(--vscode-button-secondaryBackground);
            border-radius: 4px;
            overflow: hidden;
        }
        .view-toggle button {
            border-radius: 0;
            border: none;
        }
        .view-toggle button.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
    </style>
</head>
<body>
    <!-- 툴바 -->
    <div class="toolbar">
        <span class="toolbar-title">Viz Vibe</span>
        
        <div class="view-toggle">
            <button id="btnGraphView" class="active" onclick="switchView('graph')">📊 Graph</button>
            <button id="btnSourceView" onclick="switchView('source')">📝 Source</button>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <button onclick="openAddNodeModal('start')" title="Start">+ Start</button>
        <button onclick="openAddNodeModal('ai-task')" title="AI Task">+ AI</button>
        <button onclick="openAddNodeModal('human-task')" title="Human Task">+ Human</button>
        <button onclick="openAddNodeModal('condition')" title="Condition">+ Cond</button>
        <button onclick="openAddNodeModal('blocker')" title="Blocker">+ Block</button>
        
        <div class="toolbar-divider"></div>
        
        <select id="flowDirection" onchange="changeDirection()" title="Layout direction">
            <option value="TD">↓ Top-Down</option>
            <option value="LR">→ Left-Right</option>
            <option value="BT">↑ Bottom-Top</option>
            <option value="RL">← Right-Left</option>
        </select>
        
        <span class="spacer"></span>
        
        <button class="secondary" onclick="resetView()" title="Reset view">🎯 Reset</button>
    </div>

    <!-- Main container -->
    <div class="main-container">
        <!-- Graph view -->
        <div id="graph-view">
            <div id="canvas-wrapper">
                <div id="mermaid-container">
                    <div id="mermaid-output"></div>
                </div>
            </div>

            <!-- Node info card -->
            <div id="info-card" class="info-card" style="display:none;">
                <button class="close-btn" onclick="closeInfoCard()">×</button>
                <h4 id="info-label"></h4>
                <p id="info-prompt"></p>
                <button class="copy-btn" onclick="copyNodeInfo()">📋 Copy</button>
            </div>

            <!-- Zoom controls -->
            <div class="zoom-controls">
                <button onclick="zoomIn()" title="Zoom in">+</button>
                <div class="zoom-level" id="zoomLevel">100%</div>
                <button onclick="zoomOut()" title="Zoom out">−</button>
                <button onclick="fitToScreen()" title="Fit to screen" style="font-size:12px;">⊞</button>
            </div>
        </div>

        <!-- Source view -->
        <div id="source-view">
            <textarea id="source-editor" spellcheck="false"></textarea>
        </div>
    </div>

    <!-- Context menu -->
    <div id="context-menu" class="context-menu">
        <div class="context-menu-item" onclick="copyNodeId()">Copy Node ID</div>
        <div class="context-menu-item" onclick="copyNodeLabel()">Copy Label</div>
        <div class="context-menu-item" onclick="copyNodeDescription()">Copy Description</div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" onclick="copyNodeAll()">Copy All</div>
    </div>

    <!-- Toast notification -->
    <div id="toast" class="toast"></div>

    <!-- Status bar -->
    <div class="status-bar">
        <span><span class="status-dot"></span>Ready</span>
        <span id="nodeCount">Nodes: 0</span>
        <span class="spacer"></span>
        <span class="help-hint">🖱 Drag: Pan • Scroll: Zoom • Click: Info • Right-click: Copy</span>
    </div>

    <!-- Add node modal -->
    <div id="addNodeModal" class="modal-overlay">
        <div class="modal">
            <h3 id="modalTitle">Add New Node</h3>
            <input type="hidden" id="nodeType" />
            <label>Node ID (letters, numbers, _ only)</label>
            <input type="text" id="nodeId" placeholder="e.g. task_login_impl" />
            <label>Label (displayed on graph)</label>
            <input type="text" id="nodeLabel" placeholder="e.g. Login Implementation" />
            <label>Description (details)</label>
            <textarea id="nodePrompt" placeholder="e.g. JWT-based login implementation"></textarea>
            <label>Connect from (optional)</label>
            <select id="connectFrom">
                <option value="">No connection</option>
            </select>
            <div class="modal-buttons">
                <button class="secondary" onclick="closeAddNodeModal()">Cancel</button>
                <button onclick="confirmAddNode()">Add</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        let mermaidCode = '';
        let currentView = 'graph';
        let nodeMetadata = {}; // {nodeId: {type, prompt}}
        let selectedNodeId = null;
        let selectedNodeLabel = '';
        
        // Zoom/pan state
        let transform = { x: 50, y: 50, scale: 1 };
        let isPanning = false;
        let startPan = { x: 0, y: 0 };

        // Mermaid initialization
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            flowchart: {
                useMaxWidth: false,
                htmlLabels: true,
                curve: 'basis',
                rankSpacing: 50,
                nodeSpacing: 30
            },
            themeVariables: {
                primaryColor: '#334155',
                primaryTextColor: '#f8fafc',
                primaryBorderColor: '#475569',
                lineColor: '#475569',
                secondaryColor: '#1e293b',
                tertiaryColor: '#0f172a',
                fontSize: '14px'
            }
        });

        // Parse metadata from comments
        let lastActiveNodeId = null;
        function parseMetadata(code) {
            nodeMetadata = {};
            lastActiveNodeId = null;

            // Parse lastActive
            const lastActiveMatch = code.match(/%% @lastActive:\\s*(\\w+)/);
            if (lastActiveMatch) {
                lastActiveNodeId = lastActiveMatch[1];
            }

            // Support both old format [type] and new format [type, state]
            const metaRegex = /%% @(\\w+) \\[([\\w-]+)(?:,\\s*(\\w+))?\\]: (.+)/g;
            let match;
            while ((match = metaRegex.exec(code)) !== null) {
                nodeMetadata[match[1]] = {
                    type: match[2],
                    state: match[3] || 'opened',
                    prompt: match[4]
                };
            }
        }

        // Extract node list
        function extractNodes(code) {
            const nodes = [];
            // Node definition pattern: nodeId["label"] or nodeId(["label"]) etc
            const nodeRegex = /^\\s+(\\w+)(?:\\[|\\(|\\{)/gm;
            let match;
            while ((match = nodeRegex.exec(code)) !== null) {
                if (!nodes.includes(match[1]) && match[1] !== 'style' && match[1] !== 'flowchart') {
                    nodes.push(match[1]);
                }
            }
            return nodes;
        }

        // Extract direction
        function extractDirection(code) {
            const match = code.match(/flowchart\\s+(TD|LR|BT|RL)/);
            return match ? match[1] : 'TD';
        }

        function updateTransform() {
            const wrapper = document.getElementById('canvas-wrapper');
            wrapper.style.transform = 'translate(' + transform.x + 'px, ' + transform.y + 'px) scale(' + transform.scale + ')';
            document.getElementById('zoomLevel').innerText = Math.round(transform.scale * 100) + '%';
        }

        // Add descriptions to node definitions before rendering
        function addDescriptionsToCode(code) {
            const lines = code.split('\\n');
            const result = [];
            for (const line of lines) {
                let newLine = line;
                // Skip comments and style lines
                if (!line.trim().startsWith('%') && !line.trim().startsWith('style')) {
                    for (const [nodeId, meta] of Object.entries(nodeMetadata)) {
                        if (!meta.prompt) continue;
                        // Check if this line defines this node (contains nodeId followed by ( or [)
                        const nodePattern = new RegExp('^\\\\s*' + nodeId + '\\\\s*[\\\\(\\\\[]');
                        if (nodePattern.test(line) && line.includes('"')) {
                            // Find the last " in the line
                            const lastQuoteIdx = line.lastIndexOf('"');
                            if (lastQuoteIdx > 0) {
                                // Truncate if too long (150 chars)
                                let desc = meta.prompt;
                                if (desc.length > 150) {
                                    desc = desc.substring(0, 147) + '...';
                                }
                                newLine = line.slice(0, lastQuoteIdx) + '<br/><span style="font-size:10px;opacity:0.6">' + desc + '</span>' + line.slice(lastQuoteIdx);
                                break;
                            }
                        }
                    }
                }
                result.push(newLine);
            }
            return result.join('\\n');
        }

        async function render() {
            if (!mermaidCode.trim()) {
                document.getElementById('mermaid-output').innerHTML = '<p style="color:#888;padding:20px;">Empty file. Add some nodes.</p>';
                return;
            }

            parseMetadata(mermaidCode);
            const nodes = extractNodes(mermaidCode);

            // 방향 드롭다운 동기화
            const direction = extractDirection(mermaidCode);
            document.getElementById('flowDirection').value = direction;

            // 연결 드롭다운 업데이트
            updateConnectDropdown(nodes);

            const container = document.getElementById('mermaid-output');

            // Add descriptions to code for proper node sizing
            const codeWithDescriptions = addDescriptionsToCode(mermaidCode);

            try {
                // 기존 SVG 제거
                const existingSvg = document.getElementById('mermaid-svg');
                if (existingSvg) existingSvg.remove();

                const { svg } = await mermaid.render('mermaid-svg', codeWithDescriptions);
                container.innerHTML = svg;

                // Node click/right-click/double-click events
                // Mermaid v10 uses .node class for node groups
                const nodeElements = container.querySelectorAll('.node');
                nodeElements.forEach(nodeEl => {
                    // Extract nodeId from element id (format: flowchart-nodeId-number)
                    const elId = nodeEl.id || '';
                    let foundNodeId = null;

                    // Try to match with known node IDs
                    for (const nid of nodes) {
                        if (elId.includes(nid) || elId.includes('flowchart-' + nid)) {
                            foundNodeId = nid;
                            break;
                        }
                    }

                    if (!foundNodeId) return;

                    const nodeId = foundNodeId;
                    nodeEl.style.cursor = 'pointer';

                    // Single click - show info
                    nodeEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        showNodeInfo(nodeId);
                    });

                    // Double click - copy all
                    nodeEl.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        selectedNodeId = nodeId;
                        extractNodeLabel(nodeEl, nodeId);
                        copyNodeAll();
                    });

                    // Right click - context menu
                    nodeEl.addEventListener('contextmenu', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        selectedNodeId = nodeId;
                        extractNodeLabel(nodeEl, nodeId);
                        showContextMenu(e.clientX, e.clientY);
                    });
                });

                document.getElementById('nodeCount').innerText = 'Nodes: ' + nodes.length;
            } catch (e) {
                container.innerHTML = '<p style="color:#ef4444;padding:20px;">Render error: ' + e.message + '</p>';
            }
        }

        // Extract label with line breaks preserved
        function extractNodeLabel(nodeEl, nodeId) {
            const textEl = nodeEl ? nodeEl.querySelector('.nodeLabel, text, foreignObject') : null;
            if (textEl) {
                let html = textEl.innerHTML || '';
                // Convert <br/>, <br>, <br /> to newlines
                html = html.replace(/<br\\s*\\/?>/gi, '\\n');
                // Remove other HTML tags
                html = html.replace(/<[^>]+>/g, '');
                // Decode HTML entities
                const temp = document.createElement('div');
                temp.innerHTML = html;
                selectedNodeLabel = temp.textContent.trim();
            } else {
                selectedNodeLabel = nodeId;
            }
        }

        function showNodeInfo(nodeId) {
            const meta = nodeMetadata[nodeId] || {};
            selectedNodeId = nodeId;
            // Get label from rendered node
            const container = document.getElementById('mermaid-output');
            // Find node element by .node class and matching id
            let nodeEl = null;
            container.querySelectorAll('.node').forEach(el => {
                if (el.id && (el.id.includes(nodeId) || el.id.includes('flowchart-' + nodeId))) {
                    nodeEl = el;
                }
            });
            extractNodeLabel(nodeEl, nodeId);

            // Build status text
            const isRecent = (nodeId === lastActiveNodeId);
            const state = meta.state || 'opened';
            let statusText = state === 'closed' ? '✓ Closed' : '○ Open';
            if (isRecent) statusText += '  •  ⭐ Recent';

            document.getElementById('info-card').style.display = 'block';
            document.getElementById('info-label').innerText = selectedNodeLabel;
            document.getElementById('info-prompt').innerText = statusText + '\\n\\n' + (meta.prompt || '');
        }

        function closeInfoCard() {
            document.getElementById('info-card').style.display = 'none';
        }

        // Context menu functions
        function showContextMenu(x, y) {
            const menu = document.getElementById('context-menu');
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.classList.add('active');
        }

        function hideContextMenu() {
            document.getElementById('context-menu').classList.remove('active');
        }

        // Copy functions
        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
        }

        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Copied to clipboard!');
            }).catch(() => {
                showToast('Failed to copy');
            });
            hideContextMenu();
        }

        function copyNodeId() {
            if (selectedNodeId) {
                copyToClipboard(selectedNodeId);
            }
        }

        function copyNodeLabel() {
            if (selectedNodeLabel) {
                copyToClipboard(selectedNodeLabel);
            }
        }

        function copyNodeDescription() {
            const meta = nodeMetadata[selectedNodeId] || {};
            copyToClipboard(meta.prompt || '');
        }

        function copyNodeAll() {
            if (!selectedNodeId) return;
            // selectedNodeLabel already contains label + description from rendering
            copyToClipboard(selectedNodeLabel);
        }

        function copyNodeInfo() {
            copyNodeAll();
        }

        // Close context menu on click outside
        document.addEventListener('click', hideContextMenu);
        document.addEventListener('contextmenu', (e) => {
            if (!e.target.closest('.node')) {
                hideContextMenu();
            }
        });

        function updateConnectDropdown(nodes) {
            const select = document.getElementById('connectFrom');
            select.innerHTML = '<option value="">No connection</option>';
            nodes.forEach(id => {
                select.innerHTML += '<option value="' + id + '">' + id + '</option>';
            });
        }

        // === View switching ===
        function switchView(view) {
            currentView = view;
            const graphView = document.getElementById('graph-view');
            const sourceView = document.getElementById('source-view');
            const btnGraph = document.getElementById('btnGraphView');
            const btnSource = document.getElementById('btnSourceView');
            
            if (view === 'graph') {
                graphView.classList.remove('hidden');
                sourceView.classList.remove('active');
                btnGraph.classList.add('active');
                btnSource.classList.remove('active');
                render();
            } else {
                graphView.classList.add('hidden');
                sourceView.classList.add('active');
                btnGraph.classList.remove('active');
                btnSource.classList.add('active');
                document.getElementById('source-editor').value = mermaidCode;
            }
        }

        // Source editor change detection
        document.getElementById('source-editor').addEventListener('input', (e) => {
            mermaidCode = e.target.value;
            vscode.postMessage({ type: 'update', mermaidCode });
        });

        // === Zoom/Panning ===
        const graphView = document.getElementById('graph-view');
        
        graphView.addEventListener('mousedown', (e) => {
            if (e.target.closest('.info-card') || e.target.closest('.zoom-controls')) return;
            isPanning = true;
            startPan = { x: e.clientX - transform.x, y: e.clientY - transform.y };
            graphView.classList.add('grabbing');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            transform.x = e.clientX - startPan.x;
            transform.y = e.clientY - startPan.y;
            updateTransform();
        });

        document.addEventListener('mouseup', () => {
            isPanning = false;
            graphView.classList.remove('grabbing');
        });

        graphView.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(0.2, Math.min(3, transform.scale * delta));
            
            const rect = graphView.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            
            transform.x = mx - (mx - transform.x) * (newScale / transform.scale);
            transform.y = my - (my - transform.y) * (newScale / transform.scale);
            transform.scale = newScale;
            
            updateTransform();
        });

        function zoomIn() {
            transform.scale = Math.min(3, transform.scale * 1.2);
            updateTransform();
        }

        function zoomOut() {
            transform.scale = Math.max(0.2, transform.scale / 1.2);
            updateTransform();
        }

        function resetView() {
            transform = { x: 50, y: 50, scale: 1 };
            updateTransform();
        }

        function fitToScreen() {
            const container = document.getElementById('graph-view');
            const mermaidEl = document.getElementById('mermaid-container');
            const cRect = container.getBoundingClientRect();
            const mRect = mermaidEl.getBoundingClientRect();
            
            if (mRect.width === 0 || mRect.height === 0) return;
            
            const scaleX = (cRect.width - 100) / (mRect.width / transform.scale);
            const scaleY = (cRect.height - 100) / (mRect.height / transform.scale);
            transform.scale = Math.min(scaleX, scaleY, 1.5);
            transform.x = 50;
            transform.y = 50;
            updateTransform();
        }

        // === Direction change ===
        function changeDirection() {
            const newDir = document.getElementById('flowDirection').value;
            mermaidCode = mermaidCode.replace(/flowchart\\s+(TD|LR|BT|RL)/, 'flowchart ' + newDir);
            vscode.postMessage({ type: 'update', mermaidCode });
            render();
        }

        // === Node creation ===
        const nodeShapes = {
            'start': { open: '(["', close: '"])', style: 'fill:#10b981,stroke:#059669,color:#fff,stroke-width:2px' },
            'end': { open: '(["', close: '"])', style: 'fill:#64748b,stroke:#475569,color:#fff,stroke-width:2px' },
            'ai-task': { open: '["', close: '"]', style: 'fill:#334155,stroke:#475569,color:#f8fafc,stroke-width:1px' },
            'human-task': { open: '["', close: '"]', style: 'fill:#1e293b,stroke:#6366f1,color:#f8fafc,stroke-width:2px' },
            'condition': { open: '{"', close: '"}', style: 'fill:#0f172a,stroke:#f59e0b,color:#fbbf24,stroke-width:2px' },
            'blocker': { open: '{{"', close: '"}}', style: 'fill:#450a0a,stroke:#dc2626,color:#fca5a5,stroke-width:2px' }
        };

        function openAddNodeModal(type) {
            document.getElementById('nodeType').value = type;
            document.getElementById('modalTitle').innerText = 'Add New ' + type.toUpperCase() + ' Node';
            document.getElementById('nodeId').value = 'node_' + Date.now();
            document.getElementById('nodeLabel').value = '';
            document.getElementById('nodePrompt').value = '';
            document.getElementById('addNodeModal').classList.add('active');
            setTimeout(() => document.getElementById('nodeLabel').focus(), 100);
        }

        function closeAddNodeModal() {
            document.getElementById('addNodeModal').classList.remove('active');
        }

        function confirmAddNode() {
            const type = document.getElementById('nodeType').value;
            const nodeId = document.getElementById('nodeId').value.trim().replace(/[^a-zA-Z0-9_]/g, '_') || ('node_' + Date.now());
            const label = document.getElementById('nodeLabel').value.trim() || type;
            const prompt = document.getElementById('nodePrompt').value.trim();
            const connectFrom = document.getElementById('connectFrom').value;
            
            const shape = nodeShapes[type] || nodeShapes['ai-task'];
            
            // Generate new code
            let newCode = '';

            // Metadata comment
            if (prompt) {
                newCode += '    %% @' + nodeId + ' [' + type + ']: ' + prompt.replace(/\\n/g, ' ') + '\\n';
            }
            
            // Node definition
            newCode += '    ' + nodeId + shape.open + label + shape.close + '\\n';

            // Edge (connection)
            if (connectFrom) {
                newCode += '    ' + connectFrom + ' --> ' + nodeId + '\\n';
            }

            // Style
            newCode += '    style ' + nodeId + ' ' + shape.style + '\\n';

            // Add to existing code
            if (!mermaidCode.trim()) {
                mermaidCode = 'flowchart TD\\n' + newCode;
            } else {
                // Add before styles section or at end
                const stylesMatch = mermaidCode.match(/\\n(\\s*style\\s)/);
                if (stylesMatch) {
                    const pos = mermaidCode.indexOf(stylesMatch[0]);
                    mermaidCode = mermaidCode.slice(0, pos) + '\\n' + newCode + mermaidCode.slice(pos);
                } else {
                    mermaidCode += '\\n' + newCode;
                }
            }
            
            closeAddNodeModal();
            vscode.postMessage({ type: 'update', mermaidCode });
            render();
        }

        // === Message handler ===
        window.onmessage = (e) => {
            if (e.data.type === 'load') {
                mermaidCode = e.data.mermaidCode || '';
                if (currentView === 'graph') {
                    render();
                } else {
                    document.getElementById('source-editor').value = mermaidCode;
                }
            }
        };

        // Close modal
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.onclick = (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    modal.classList.remove('active');
                }
            };
        });

        // Enter key
        document.getElementById('nodeLabel').onkeydown = (e) => {
            if (e.key === 'Enter') confirmAddNode();
        };

        updateTransform();
    </script>
</body>
</html>`;
  }
}
