import * as vscode from 'vscode';

export class VizFlowEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'vizVibe.vizflowEditor';
  
  // Track active webview panel for search command
  private static activeWebviewPanel: vscode.WebviewPanel | null = null;

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

  // Trigger search in the active webview (called from extension.ts via Cmd+F)
  public static triggerSearch(): void {
    if (VizFlowEditorProvider.activeWebviewPanel) {
      VizFlowEditorProvider.activeWebviewPanel.webview.postMessage({ type: 'openSearch' });
    }
  }

  constructor(private readonly context: vscode.ExtensionContext) { }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Track this as the active webview panel
    VizFlowEditorProvider.activeWebviewPanel = webviewPanel;
    
    // Update active panel when view state changes
    webviewPanel.onDidChangeViewState(e => {
      if (e.webviewPanel.active) {
        VizFlowEditorProvider.activeWebviewPanel = e.webviewPanel;
      }
    });

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'update') {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), message.mermaidCode);
        await vscode.workspace.applyEdit(edit);
      } else if (message.type === 'openInDefaultEditor') {
        // Open file in VS Code's default text editor for native search
        await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
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

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      if (VizFlowEditorProvider.activeWebviewPanel === webviewPanel) {
        VizFlowEditorProvider.activeWebviewPanel = null;
      }
    });
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
            user-select: none;
            -webkit-user-select: none;
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

        /* Node hover */
        .node rect, .node polygon, .node circle, .node ellipse {
            cursor: grab;
            transition: all 0.15s;
        }
        .node.dragging rect, .node.dragging polygon, .node.dragging circle, .node.dragging ellipse {
            cursor: grabbing;
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

        /* Search box */
        .search-container {
            position: relative;
            display: flex;
            align-items: center;
        }
        .search-box {
            display: none;
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 8px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            padding: 8px 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 200;
            min-width: 280px;
        }
        .search-box.active { display: flex; gap: 8px; align-items: center; }
        .search-box input {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: var(--vscode-input-foreground);
            font-size: 12px;
            min-width: 180px;
        }
        .search-box input::placeholder { color: var(--vscode-input-placeholderForeground); }
        .search-info {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
        }
        .search-nav {
            display: flex;
            gap: 2px;
        }
        .search-nav button {
            padding: 2px 6px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
        }

        .search-nav button:hover { background: var(--vscode-button-hoverBackground); }
        .search-close {
            background: none !important;
            color: var(--vscode-descriptionForeground) !important;
            font-size: 14px !important;
            padding: 2px 4px !important;
        }

        /* Node highlight for search */
        .node.search-match rect,
        .node.search-match polygon,
        .node.search-match circle,
        .node.search-match ellipse {
            filter: brightness(1.2) drop-shadow(0 0 8px rgba(74, 222, 128, 0.6));
        }
        .node.search-current rect,
        .node.search-current polygon,
        .node.search-current circle,
        .node.search-current ellipse {
            filter: brightness(1.4) drop-shadow(0 0 12px rgba(250, 204, 21, 0.8));
            stroke: #facc15 !important;
            stroke-width: 3px !important;
        }
        .node.search-dimmed {
            opacity: 0.3;
        }

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

        /* Initialization prompt overlay */
        .init-prompt-overlay {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            display: none;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.95) 100%);
            z-index: 80;
            backdrop-filter: blur(4px);
        }
        .init-prompt-overlay.active { display: flex; }
        .init-prompt-card {
            background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
            border: 2px solid #3b82f6;
            border-radius: 16px;
            padding: 40px 48px;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6),
                        0 0 40px rgba(59, 130, 246, 0.15);
            max-width: 500px;
            animation: pulse-glow 2s ease-in-out infinite;
        }
        @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(59, 130, 246, 0.15); }
            50% { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 60px rgba(59, 130, 246, 0.25); }
        }
        .init-prompt-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        .init-prompt-title {
            font-size: 22px;
            font-weight: 600;
            color: #f1f5f9;
            margin-bottom: 12px;
            line-height: 1.3;
        }
        .init-prompt-subtitle {
            font-size: 14px;
            color: #94a3b8;
            margin-bottom: 24px;
            line-height: 1.5;
        }
        .init-prompt-code {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 16px 20px;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 15px;
            color: #38bdf8;
            margin-bottom: 20px;
            user-select: all;
            cursor: text;
        }
        .init-prompt-code:hover {
            border-color: #3b82f6;
            background: #1e293b;
        }
        .init-prompt-hint {
            font-size: 11px;
            color: #64748b;
            display: flex;
            gap: 16px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .init-prompt-hint span {
            display: flex;
            align-items: center;
            gap: 4px;
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

    </style>
</head>
<body>
    <!-- 툴바 -->
    <div class="toolbar">
        <button class="secondary" onclick="openInDefaultEditor()" title="Open in VS Code editor">📝 Edit Source</button>

        <select id="flowDirection" onchange="changeDirection()" title="Layout direction">
            <option value="TD">↓ Top-Down</option>
            <option value="LR">→ Left-Right</option>
            <option value="BT">↑ Bottom-Top</option>
            <option value="RL">← Right-Left</option>
        </select>

        <span class="spacer"></span>

        <div class="search-container">
            <button class="secondary" onclick="toggleSearch()" title="Search nodes (Cmd+F)">🔍 Search</button>
            <div id="search-box" class="search-box">
                <input type="text" id="search-input" placeholder="Search nodes..." autocomplete="off" />
                <span id="search-info" class="search-info"></span>
                <div class="search-nav">
                    <button onclick="navigateSearch(-1)" title="Previous (Shift+Enter)">▲</button>
                    <button onclick="navigateSearch(1)" title="Next (Enter)">▼</button>
                </div>
                <button class="search-close" onclick="closeSearch()">×</button>
            </div>
        </div>
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

            <!-- Initialization prompt overlay -->
            <div id="init-prompt-overlay" class="init-prompt-overlay">
                <div class="init-prompt-card">
                    <div class="init-prompt-title" style="font-size:28px;margin-bottom:24px;">👇 Copy this and<br/>Ask your AI agent to setup vizvibe!</div>
                    <div class="init-prompt-code" onclick="copyInitPrompt()" style="font-size:14px;padding:20px 24px;">
                        "Please setup vizvibe for this project.<br/>Write the trajectory in my language."
                    </div>
                </div>
            </div>
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
        <span class="help-hint">🖱 Scroll: Pan • ⌘/Ctrl+Scroll: Zoom • Click: Info • Cmd+F: Search</span>
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
        let nodeMetadata = {}; // {nodeId: {type, prompt}}
        let selectedNodeId = null;
        let selectedNodeLabel = '';

        // Zoom/pan state
        let transform = { x: 50, y: 50, scale: 1 };
        let isPanning = false;
        let startPan = { x: 0, y: 0 };

        // Node drag state
        let isDraggingNode = false;
        let draggingNodeId = null;
        let dragStartPos = { x: 0, y: 0 };
        let nodeOffsets = {}; // { nodeId: { x, y } }

        // Search state
        let searchResults = [];
        let currentSearchIndex = -1;
        let isSearchActive = false;

        // Initial load state - for focusing on RECENT node on first open
        let isFirstLoad = true;
        // Flag for focusing on RECENT after direction change
        let pendingFocusOnRecent = false;

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

            // Support formats: [type], [type, state], [type, state, date], [type, state, date, author]
            // Description after colon is optional
            const metaRegex = /%% @(\\w+) \\[([\\w-]+)(?:,\\s*(\\w+))?(?:,\\s*([\\d-]+))?(?:,\\s*([\\w@.-]+))?\\](?::\\s*(.+))?/g;
            let match;
            while ((match = metaRegex.exec(code)) !== null) {
                nodeMetadata[match[1]] = {
                    type: match[2],
                    state: match[3] || 'opened',
                    date: match[4] || null,
                    author: match[5] || null,
                    prompt: match[6] || null
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

        // Add descriptions and date/author to node definitions before rendering
        function addDescriptionsToCode(code) {
            const lines = code.split('\\n');
            const result = [];
            for (const line of lines) {
                let newLine = line;
                // Skip comments and style lines
                if (!line.trim().startsWith('%') && !line.trim().startsWith('style')) {
                    for (const [nodeId, meta] of Object.entries(nodeMetadata)) {
                        // Check if this line defines this node (contains nodeId followed by ( or [)
                        const nodePattern = new RegExp('^\\\\s*' + nodeId + '\\\\s*[\\\\(\\\\[]');
                        if (nodePattern.test(line) && line.includes('"')) {
                            // Find the last " in the line
                            const lastQuoteIdx = line.lastIndexOf('"');
                            if (lastQuoteIdx > 0) {
                                let additions = '';
                                // Add prompt/description if available
                                if (meta.prompt) {
                                    let desc = meta.prompt;
                                    if (desc.length > 150) {
                                        desc = desc.substring(0, 147) + '...';
                                    }
                                    additions += '<br/><span style="font-size:10px;opacity:0.6">' + desc + '</span>';
                                }
                                // Build date/author label if available
                                if (meta.date || meta.author) {
                                    const parts = [];
                                    if (meta.date) parts.push(meta.date);
                                    if (meta.author) parts.push(meta.author);
                                    additions += '<br/><span style="font-size:9px;opacity:0.4;color:#888">' + parts.join(' · ') + '</span>';
                                }
                                if (additions) {
                                    newLine = line.slice(0, lastQuoteIdx) + additions + line.slice(lastQuoteIdx);
                                }
                                break;
                            }
                        }
                    }
                }
                result.push(newLine);
            }
            return result.join('\\n');
        }

        // Check if trajectory is in template state (only has project_start node)
        function isTemplateState(nodes) {
            if (nodes.length === 0) return true;
            if (nodes.length === 1 && (nodes[0] === 'project_start' || nodes[0] === 'Start')) return true;
            // Also check if there are only style/connection lines but effectively just one node
            const meaningfulNodes = nodes.filter(n => !['style', 'flowchart', 'subgraph', 'end'].includes(n.toLowerCase()));
            return meaningfulNodes.length <= 1;
        }

        // Show or hide initialization prompt
        function updateInitPrompt(show) {
            const overlay = document.getElementById('init-prompt-overlay');
            if (overlay) {
                if (show) {
                    overlay.classList.add('active');
                } else {
                    overlay.classList.remove('active');
                }
            }
        }

        // Copy initialization prompt to clipboard
        function copyInitPrompt() {
            const prompt = 'Please setup vizvibe for this project by reading the README and git history, then creating an initial trajectory graph. Write the trajectory in my language.';
            navigator.clipboard.writeText(prompt).then(() => {
                showToast('📋 Prompt copied! Paste it in your AI chat.');
            }).catch(() => {
                showToast('Copy failed - select and copy manually');
            });
        }

        async function render() {
            if (!mermaidCode.trim()) {
                document.getElementById('mermaid-output').innerHTML = '<p style="color:#888;padding:20px;">Empty file. Add some nodes.</p>';
                updateInitPrompt(true);
                return;
            }

            parseMetadata(mermaidCode);
            const nodes = extractNodes(mermaidCode);

            // 방향 드롭다운 동기화
            const direction = extractDirection(mermaidCode);
            document.getElementById('flowDirection').value = direction;

            // 연결 드롭다운 업데이트
            updateConnectDropdown(nodes);

            // Check for template state and show/hide init prompt
            const showInitPrompt = isTemplateState(nodes);
            updateInitPrompt(showInitPrompt);

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
                    
                    // Save base transform and apply saved offset if exists
                    const baseTransform = nodeEl.getAttribute('transform') || '';
                    nodeEl.setAttribute('data-base-transform', baseTransform);
                    
                    if (nodeOffsets[nodeId]) {
                        const offset = nodeOffsets[nodeId];
                        nodeEl.setAttribute('transform', baseTransform + ' translate(' + offset.x + ',' + offset.y + ')');
                    }

                    // Node drag handlers
                    nodeEl.addEventListener('mousedown', (e) => {
                        if (e.button !== 0) return; // Left button only
                        e.stopPropagation();
                        isDraggingNode = true;
                        draggingNodeId = nodeId;
                        nodeEl.classList.add('dragging');
                        
                        // Get current offset or initialize
                        const currentOffset = nodeOffsets[nodeId] || { x: 0, y: 0 };
                        dragStartPos = {
                            x: e.clientX / transform.scale - currentOffset.x,
                            y: e.clientY / transform.scale - currentOffset.y
                        };
                    });

                    // Single click - show info (only if not dragging)
                    let dragDistance = 0;
                    nodeEl.addEventListener('click', (e) => {
                        if (dragDistance > 5) {
                            dragDistance = 0;
                            return; // Skip if dragged
                        }
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

            // Add date/author if available
            let dateAuthorText = '';
            if (meta.date || meta.author) {
                const parts = [];
                if (meta.date) parts.push('📅 ' + meta.date);
                if (meta.author) parts.push('👤 ' + meta.author);
                dateAuthorText = '\\n' + parts.join('  •  ');
            }

            document.getElementById('info-card').style.display = 'block';
            document.getElementById('info-label').innerText = selectedNodeLabel;
            document.getElementById('info-prompt').innerText = statusText + dateAuthorText + '\\n\\n' + (meta.prompt || '');
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

        // Open file in VS Code's default editor
        function openInDefaultEditor() {
            vscode.postMessage({ type: 'openInDefaultEditor' });
        }

        // === Zoom/Panning ===
        const graphView = document.getElementById('graph-view');
        
        graphView.addEventListener('mousedown', (e) => {
            if (e.target.closest('.info-card') || e.target.closest('.zoom-controls')) return;
            isPanning = true;
            startPan = { x: e.clientX - transform.x, y: e.clientY - transform.y };
            graphView.classList.add('grabbing');
        });

        document.addEventListener('mousemove', (e) => {
            // Node dragging takes priority
            if (isDraggingNode && draggingNodeId) {
                const newX = e.clientX / transform.scale - dragStartPos.x;
                const newY = e.clientY / transform.scale - dragStartPos.y;
                
                nodeOffsets[draggingNodeId] = { x: newX, y: newY };
                
                // Find and update the node element
                const container = document.getElementById('mermaid-output');
                
                container.querySelectorAll('.node').forEach(nodeEl => {
                    if (nodeEl.id && (nodeEl.id.includes(draggingNodeId) || nodeEl.id.includes('flowchart-' + draggingNodeId))) {
                        // Update transform
                        const baseTransform = nodeEl.getAttribute('data-base-transform') || '';
                        nodeEl.setAttribute('transform', baseTransform + ' translate(' + newX + ',' + newY + ')');
                    }
                });
                
                return;
            }
            
            if (!isPanning) return;
            transform.x = e.clientX - startPan.x;
            transform.y = e.clientY - startPan.y;
            updateTransform();
        });
        
        // Store edge connections parsed from mermaid code
        let edgeConnections = []; // [{from: 'nodeA', to: 'nodeB', pathIndex: 0}, ...]
        
        // Parse edge connections from mermaid code
        function parseEdgeConnections(code) {
            edgeConnections = [];
            // Match patterns like: nodeA --> nodeB, nodeA -.-> nodeB, etc.
            const edgeRegex = /(\\w+)\\s*(?:-->|-.->|==>|--o|--x)\\s*(\\w+)/g;
            let match;
            let index = 0;
            while ((match = edgeRegex.exec(code)) !== null) {
                edgeConnections.push({
                    from: match[1],
                    to: match[2],
                    index: index++
                });
            }
        }
        
        // Function to update edges connected to a node
        function updateEdgesForNode(nodeId, offsetX, offsetY) {
            const container = document.getElementById('mermaid-output');
            const svg = container.querySelector('svg');
            if (!svg) return;
            
            // Parse connections if not already done
            if (edgeConnections.length === 0) {
                parseEdgeConnections(mermaidCode);
            }
            
            // Find edges connected to this node
            const connectedEdges = edgeConnections.filter(e => e.from === nodeId || e.to === nodeId);
            if (connectedEdges.length === 0) return;
            
            // In Mermaid v10, edges are rendered as path elements
            // They can be in .edgePaths g elements or directly as path.flowchart-link
            const allPaths = svg.querySelectorAll('path.flowchart-link, .edgePath path, .edgePaths path');
            
            // Also try to find edge labels and markers
            const edgeGroups = svg.querySelectorAll('.edgePath, .edge, [class*="edge"]');
            
            // For each path, try to determine which edge it represents
            allPaths.forEach((pathEl, pathIndex) => {
                // Store original path
                if (!pathEl.hasAttribute('data-original-d')) {
                    pathEl.setAttribute('data-original-d', pathEl.getAttribute('d') || '');
                }
                
                // Try to find which edge this path belongs to
                // Method 1: Check parent element ID
                let parent = pathEl.closest('[id*="-"]') || pathEl.parentElement;
                let edgeId = parent ? (parent.id || '') : '';
                
                // Method 2: Check path's class or data attributes
                const pathClass = pathEl.getAttribute('class') || '';
                
                // Try to match with our edge connections
                let matchedEdge = null;
                
                // Check if edgeId contains node IDs
                for (const edge of connectedEdges) {
                    if (edgeId.includes(edge.from) && edgeId.includes(edge.to)) {
                        matchedEdge = edge;
                        break;
                    }
                    // Also check by index if paths are in order
                    if (pathIndex === edge.index) {
                        matchedEdge = edge;
                        break;
                    }
                }
                
                // If still no match, check by parent's ID pattern
                if (!matchedEdge && edgeId) {
                    for (const edge of connectedEdges) {
                        // Mermaid often uses format like "L-from-to" or "flowchart-from-to"
                        if (edgeId.toLowerCase().includes(edge.from.toLowerCase()) || 
                            edgeId.toLowerCase().includes(edge.to.toLowerCase())) {
                            matchedEdge = edge;
                            break;
                        }
                    }
                }
                
                if (!matchedEdge) return;
                
                const isSource = matchedEdge.from === nodeId;
                const originalD = pathEl.getAttribute('data-original-d') || '';
                
                // Parse and modify the path
                const pathCommands = parsePathD(originalD);
                if (pathCommands.length === 0) return;
                
                if (isSource) {
                    // Offset start of path
                    if (pathCommands[0]) {
                        pathCommands[0].x = (parseFloat(pathCommands[0].origX) || 0) + offsetX;
                        pathCommands[0].y = (parseFloat(pathCommands[0].origY) || 0) + offsetY;
                    }
                    // Offset first control point for curves
                    if (pathCommands.length > 1 && pathCommands[1].type === 'C') {
                        pathCommands[1].x1 = (parseFloat(pathCommands[1].origX1) || 0) + offsetX;
                        pathCommands[1].y1 = (parseFloat(pathCommands[1].origY1) || 0) + offsetY;
                    }
                } else {
                    // Offset end of path
                    const lastIdx = pathCommands.length - 1;
                    if (pathCommands[lastIdx]) {
                        pathCommands[lastIdx].x = (parseFloat(pathCommands[lastIdx].origX) || 0) + offsetX;
                        pathCommands[lastIdx].y = (parseFloat(pathCommands[lastIdx].origY) || 0) + offsetY;
                    }
                    // Offset last control point for curves
                    if (pathCommands[lastIdx] && pathCommands[lastIdx].type === 'C') {
                        pathCommands[lastIdx].x2 = (parseFloat(pathCommands[lastIdx].origX2) || 0) + offsetX;
                        pathCommands[lastIdx].y2 = (parseFloat(pathCommands[lastIdx].origY2) || 0) + offsetY;
                    }
                }
                
                const newD = buildPathD(pathCommands);
                pathEl.setAttribute('d', newD);
            });
        }
        
        // Parse SVG path 'd' attribute into commands
        function parsePathD(d) {
            const commands = [];
            // Simple regex to extract path commands
            const regex = /([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/gi;
            let match;
            while ((match = regex.exec(d)) !== null) {
                const type = match[1].toUpperCase();
                const args = match[2].trim().split(/[\\s,]+/).map(Number).filter(n => !isNaN(n));
                
                if (type === 'M' || type === 'L') {
                    commands.push({ type, x: args[0], y: args[1], origX: args[0], origY: args[1] });
                } else if (type === 'C') {
                    commands.push({ 
                        type, 
                        x1: args[0], y1: args[1], 
                        x2: args[2], y2: args[3], 
                        x: args[4], y: args[5],
                        origX1: args[0], origY1: args[1],
                        origX2: args[2], origY2: args[3],
                        origX: args[4], origY: args[5]
                    });
                } else if (type === 'Z') {
                    commands.push({ type });
                } else {
                    // Handle other commands as-is
                    commands.push({ type, args });
                }
            }
            return commands;
        }
        
        // Build SVG path 'd' attribute from commands
        function buildPathD(commands) {
            return commands.map(cmd => {
                if (cmd.type === 'M' || cmd.type === 'L') {
                    return cmd.type + cmd.x + ',' + cmd.y;
                } else if (cmd.type === 'C') {
                    return cmd.type + cmd.x1 + ',' + cmd.y1 + ' ' + cmd.x2 + ',' + cmd.y2 + ' ' + cmd.x + ',' + cmd.y;
                } else if (cmd.type === 'Z') {
                    return 'Z';
                } else if (cmd.args) {
                    return cmd.type + cmd.args.join(',');
                }
                return '';
            }).join(' ');
        }

        document.addEventListener('mouseup', () => {
            // End node dragging
            if (isDraggingNode && draggingNodeId) {
                const container = document.getElementById('mermaid-output');
                container.querySelectorAll('.node').forEach(nodeEl => {
                    nodeEl.classList.remove('dragging');
                });
                
                isDraggingNode = false;
                draggingNodeId = null;
            }
            
            isPanning = false;
            graphView.classList.remove('grabbing');
        });
        
        // Redraw all edges based on current node positions
        function redrawAllEdges(svg) {
            // Parse edge connections from mermaid code
            parseEdgeConnections(mermaidCode);
            
            // Hide original Mermaid edges
            svg.querySelectorAll('.edgePath, .edgePaths').forEach(g => {
                g.style.display = 'none';
            });
            
            // Remove previously drawn custom edges
            svg.querySelectorAll('.vizvibe-edge').forEach(el => el.remove());
            
            // Create a group for our custom edges
            let edgeGroup = svg.querySelector('.vizvibe-edges');
            if (!edgeGroup) {
                edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                edgeGroup.setAttribute('class', 'vizvibe-edges');
                // Insert before nodes so edges are behind
                const nodesGroup = svg.querySelector('.nodes') || svg.firstChild;
                svg.insertBefore(edgeGroup, nodesGroup);
            }
            
            // Draw each edge
            edgeConnections.forEach(conn => {
                const fromCenter = getNodeCenter(conn.from);
                const toCenter = getNodeCenter(conn.to);
                
                if (!fromCenter || !toCenter) return;
                
                // Create path element
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('class', 'vizvibe-edge');
                
                // Calculate bezier curve
                const dx = toCenter.x - fromCenter.x;
                const dy = toCenter.y - fromCenter.y;
                
                // Control points - create a smooth curve
                let cx1, cy1, cx2, cy2;
                
                if (Math.abs(dy) > Math.abs(dx)) {
                    // Mostly vertical - curve horizontally
                    cx1 = fromCenter.x;
                    cy1 = fromCenter.y + dy * 0.4;
                    cx2 = toCenter.x;
                    cy2 = fromCenter.y + dy * 0.6;
                } else {
                    // Mostly horizontal - curve vertically
                    cx1 = fromCenter.x + dx * 0.4;
                    cy1 = fromCenter.y;
                    cx2 = fromCenter.x + dx * 0.6;
                    cy2 = toCenter.y;
                }
                
                const d = 'M' + fromCenter.x + ',' + fromCenter.y + 
                    ' C' + cx1 + ',' + cy1 + ' ' + cx2 + ',' + cy2 + ' ' + toCenter.x + ',' + toCenter.y;
                
                path.setAttribute('d', d);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', '#475569');
                path.setAttribute('stroke-width', '1.5');
                path.setAttribute('marker-end', 'url(#vizvibe-arrow)');
                
                edgeGroup.appendChild(path);
            });
            
            // Add arrow marker if not exists
            if (!svg.querySelector('#vizvibe-arrow')) {
                const defs = svg.querySelector('defs') || document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                if (!svg.querySelector('defs')) svg.insertBefore(defs, svg.firstChild);
                
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                marker.setAttribute('id', 'vizvibe-arrow');
                marker.setAttribute('viewBox', '0 0 10 10');
                marker.setAttribute('refX', '8');
                marker.setAttribute('refY', '5');
                marker.setAttribute('markerWidth', '6');
                marker.setAttribute('markerHeight', '6');
                marker.setAttribute('orient', 'auto-start-reverse');
                
                const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
                arrowPath.setAttribute('fill', '#475569');
                
                marker.appendChild(arrowPath);
                defs.appendChild(marker);
            }
        }
        
        // Get node center position (including offset)
        function getNodeCenter(nodeId) {
            const container = document.getElementById('mermaid-output');
            let nodeEl = null;
            
            container.querySelectorAll('.node').forEach(el => {
                if (el.id && (el.id.includes(nodeId) || el.id.includes('flowchart-' + nodeId))) {
                    nodeEl = el;
                }
            });
            
            if (!nodeEl) return null;
            
            // Get bounding box
            const bbox = nodeEl.getBBox();
            const offset = nodeOffsets[nodeId] || { x: 0, y: 0 };
            
            // Calculate center with offset
            return {
                x: bbox.x + bbox.width / 2 + offset.x,
                y: bbox.y + bbox.height / 2 + offset.y
            };
        }
        
        // Reconnect all edges based on current node positions
        function reconnectEdges(svg) {
            // Parse connections from mermaid code
            parseEdgeConnections(mermaidCode);
            
            // Get all edge paths
            const allPaths = svg.querySelectorAll('path.flowchart-link, .edgePath path, .edgePaths path');
            
            // Show edges again
            svg.querySelectorAll('.edgePath, .edgePaths, path.flowchart-link').forEach(edge => {
                edge.style.opacity = '1';
            });
            
            // For each connection, find and update the corresponding path
            edgeConnections.forEach((conn, index) => {
                const fromCenter = getNodeCenter(conn.from);
                const toCenter = getNodeCenter(conn.to);
                
                if (!fromCenter || !toCenter) return;
                
                // Find the path for this edge (by index or ID matching)
                const pathEl = allPaths[index];
                if (!pathEl) return;
                
                // Calculate new path - simple curved line
                const dx = toCenter.x - fromCenter.x;
                const dy = toCenter.y - fromCenter.y;
                
                // Control points for bezier curve
                const cx1 = fromCenter.x + dx * 0.3;
                const cy1 = fromCenter.y;
                const cx2 = fromCenter.x + dx * 0.7;
                const cy2 = toCenter.y;
                
                // Build new path - M start, C curve to end
                const newPath = 'M' + fromCenter.x + ',' + fromCenter.y + 
                    ' C' + cx1 + ',' + cy1 + ' ' + cx2 + ',' + cy2 + ' ' + toCenter.x + ',' + toCenter.y;
                
                pathEl.setAttribute('d', newPath);
            });
        }

        // Figma-style navigation: Scroll = Pan, Ctrl/Cmd+Scroll or Pinch = Zoom
        graphView.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            // Pinch zoom on trackpad sets ctrlKey to true
            // Also support Ctrl+scroll (Windows) and Cmd+scroll (Mac)
            if (e.ctrlKey || e.metaKey) {
                // Zoom mode
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const newScale = Math.max(0.2, Math.min(3, transform.scale * delta));
                
                const rect = graphView.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;
                
                // Zoom toward mouse position
                transform.x = mx - (mx - transform.x) * (newScale / transform.scale);
                transform.y = my - (my - transform.y) * (newScale / transform.scale);
                transform.scale = newScale;
            } else {
                // Pan mode - scroll to move canvas
                transform.x -= e.deltaX;
                transform.y -= e.deltaY;
            }
            
            updateTransform();
        }, { passive: false });

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
            // Set flag to focus on RECENT after document update cycle completes
            pendingFocusOnRecent = true;
            vscode.postMessage({ type: 'update', mermaidCode });
        }

        // === Node creation ===
        const nodeShapes = {
            'start': { open: '(["', close: '"])', style: 'fill:#64748b,stroke:#475569,color:#fff,stroke-width:1px' },
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
        window.onmessage = async (e) => {
            if (e.data.type === 'load') {
                mermaidCode = e.data.mermaidCode || '';
                await render();

                // Focus on RECENT node on first load or after direction change
                if (isFirstLoad || pendingFocusOnRecent) {
                    isFirstLoad = false;
                    pendingFocusOnRecent = false;
                    focusOnRecentNode();
                }
            } else if (e.data.type === 'openSearch') {
                openSearch();
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

        // Enter key for node creation
        document.getElementById('nodeLabel').onkeydown = (e) => {
            if (e.key === 'Enter') confirmAddNode();
        };

        // === Search functionality ===
        function toggleSearch() {
            const searchBox = document.getElementById('search-box');
            if (searchBox.classList.contains('active')) {
                closeSearch();
            } else {
                openSearch();
            }
        }

        function openSearch() {
            const searchBox = document.getElementById('search-box');
            searchBox.classList.add('active');
            isSearchActive = true;
            document.getElementById('search-input').focus();
        }

        function closeSearch() {
            const searchBox = document.getElementById('search-box');
            searchBox.classList.remove('active');
            isSearchActive = false;
            clearSearchHighlights();
            document.getElementById('search-input').value = '';
            document.getElementById('search-info').textContent = '';
            searchResults = [];
            currentSearchIndex = -1;
        }

        function performSearch(query) {
            clearSearchHighlights();
            searchResults = [];
            currentSearchIndex = -1;

            if (!query.trim()) {
                document.getElementById('search-info').textContent = '';
                return;
            }

            const lowerQuery = query.toLowerCase();
            const container = document.getElementById('mermaid-output');
            const nodes = extractNodes(mermaidCode);

            // Search in node labels and metadata descriptions
            nodes.forEach(nodeId => {
                const meta = nodeMetadata[nodeId] || {};
                const label = getNodeLabelText(nodeId) || nodeId;
                const description = meta.prompt || '';
                
                if (label.toLowerCase().includes(lowerQuery) || 
                    description.toLowerCase().includes(lowerQuery) ||
                    nodeId.toLowerCase().includes(lowerQuery)) {
                    searchResults.push(nodeId);
                }
            });

            // Update UI
            if (searchResults.length > 0) {
                document.getElementById('search-info').textContent = '1/' + searchResults.length;
                currentSearchIndex = 0;
                highlightSearchResults();
                focusOnNode(searchResults[0]);
            } else {
                document.getElementById('search-info').textContent = '0 results';
            }
        }

        function getNodeLabelText(nodeId) {
            const container = document.getElementById('mermaid-output');
            let nodeEl = null;
            container.querySelectorAll('.node').forEach(el => {
                if (el.id && (el.id.includes(nodeId) || el.id.includes('flowchart-' + nodeId))) {
                    nodeEl = el;
                }
            });
            if (!nodeEl) return nodeId;
            
            const textEl = nodeEl.querySelector('.nodeLabel, text, foreignObject');
            if (textEl) {
                let text = textEl.textContent || textEl.innerText || '';
                return text.trim();
            }
            return nodeId;
        }

        function highlightSearchResults() {
            const container = document.getElementById('mermaid-output');
            const allNodes = container.querySelectorAll('.node');
            const nodes = extractNodes(mermaidCode);

            // Dim all nodes if search is active
            if (searchResults.length > 0) {
                allNodes.forEach(nodeEl => {
                    let foundNodeId = null;
                    for (const nid of nodes) {
                        if (nodeEl.id && (nodeEl.id.includes(nid) || nodeEl.id.includes('flowchart-' + nid))) {
                            foundNodeId = nid;
                            break;
                        }
                    }
                    if (foundNodeId && !searchResults.includes(foundNodeId)) {
                        nodeEl.classList.add('search-dimmed');
                    }
                });
            }

            // Highlight matches
            searchResults.forEach((nodeId, index) => {
                allNodes.forEach(nodeEl => {
                    if (nodeEl.id && (nodeEl.id.includes(nodeId) || nodeEl.id.includes('flowchart-' + nodeId))) {
                        nodeEl.classList.remove('search-dimmed');
                        if (index === currentSearchIndex) {
                            nodeEl.classList.add('search-current');
                            nodeEl.classList.remove('search-match');
                        } else {
                            nodeEl.classList.add('search-match');
                            nodeEl.classList.remove('search-current');
                        }
                    }
                });
            });
        }

        function clearSearchHighlights() {
            const container = document.getElementById('mermaid-output');
            container.querySelectorAll('.node').forEach(nodeEl => {
                nodeEl.classList.remove('search-match', 'search-current', 'search-dimmed');
            });
        }

        function navigateSearch(direction) {
            if (searchResults.length === 0) return;
            
            currentSearchIndex = (currentSearchIndex + direction + searchResults.length) % searchResults.length;
            document.getElementById('search-info').textContent = (currentSearchIndex + 1) + '/' + searchResults.length;
            highlightSearchResults();
            focusOnNode(searchResults[currentSearchIndex]);
        }

        function focusOnNode(nodeId) {
            const graphView = document.getElementById('graph-view');
            const container = document.getElementById('mermaid-output');
            const canvasWrapper = document.getElementById('canvas-wrapper');
            let nodeEl = null;
            
            container.querySelectorAll('.node').forEach(el => {
                if (el.id && (el.id.includes(nodeId) || el.id.includes('flowchart-' + nodeId))) {
                    nodeEl = el;
                }
            });
            
            if (!nodeEl) return;
            
            // Get current positions using getBoundingClientRect (screen coordinates)
            const nodeRect = nodeEl.getBoundingClientRect();
            const graphRect = graphView.getBoundingClientRect();
            const wrapperRect = canvasWrapper.getBoundingClientRect();
            
            // Calculate where the node center currently is in screen coordinates
            const nodeCenterScreenX = nodeRect.left + nodeRect.width / 2;
            const nodeCenterScreenY = nodeRect.top + nodeRect.height / 2;
            
            // Calculate where we want it (center of graph view)
            const targetScreenX = graphRect.left + graphRect.width / 2;
            const targetScreenY = graphRect.top + graphRect.height / 2;
            
            // Calculate the difference we need to move
            const deltaX = targetScreenX - nodeCenterScreenX;
            const deltaY = targetScreenY - nodeCenterScreenY;
            
            // Apply delta to current transform
            transform.x += deltaX;
            transform.y += deltaY;
            
            updateTransform();
        }

        // Focus on RECENT subgraph or lastActive node on initial load
        function focusOnRecentNode() {
            // Reset transform to origin first, then set scale
            transform.x = 0;
            transform.y = 0;
            transform.scale = 0.8;
            updateTransform();

            // Wait for DOM to settle, then find and center on target
            setTimeout(() => {
                const container = document.getElementById('mermaid-output');
                const svg = container.querySelector('svg');
                if (!svg) return;

                // Strategy 1: Find RECENT subgraph cluster (only .cluster class)
                let targetEl = svg.querySelector('.cluster[id*="recent"], .cluster[id*="RECENT"]');

                // Strategy 2: If no RECENT subgraph, find lastActive node
                if (!targetEl && lastActiveNodeId) {
                    container.querySelectorAll('.node').forEach(el => {
                        if (el.id && (el.id.includes(lastActiveNodeId) || el.id.includes('flowchart-' + lastActiveNodeId))) {
                            targetEl = el;
                        }
                    });
                }

                // Strategy 3: If still nothing, just fit to screen
                if (!targetEl) {
                    fitToScreen();
                    return;
                }

                const graphView = document.getElementById('graph-view');
                const graphRect = graphView.getBoundingClientRect();
                const targetRect = targetEl.getBoundingClientRect();

                const targetCenterX = targetRect.left + targetRect.width / 2;
                const targetCenterY = targetRect.top + targetRect.height / 2;
                const graphCenterX = graphRect.left + graphRect.width / 2;
                const graphCenterY = graphRect.top + graphRect.height / 2;

                // Calculate offset to center target in viewport
                transform.x = graphCenterX - targetCenterX;
                transform.y = graphCenterY - targetCenterY;
                updateTransform();
            }, 150);
        }

        // Search input handlers
        const searchInput = document.getElementById('search-input');
        let searchTimeout = null;
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(e.target.value);
            }, 150);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    navigateSearch(-1);
                } else {
                    navigateSearch(1);
                }
            } else if (e.key === 'Escape') {
                closeSearch();
            }
        });

        // Cmd+F / Ctrl+F keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                openSearch();
            }
        });

        updateTransform();
    </script>
</body>
</html>`;
  }
}
