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

        /* 메인 컨테이너 */
        .main-container {
            flex: 1;
            display: flex;
            overflow: hidden;
        }

        /* 그래프 뷰 */
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

        /* 소스 뷰 */
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

        /* 노드 호버 */
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

        /* 노드 정보 카드 */
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

        /* 줌 컨트롤 */
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

        /* 모달 */
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

        /* 뷰 토글 버튼 */
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
        
        <select id="flowDirection" onchange="changeDirection()" title="레이아웃 방향">
            <option value="TD">↓ Top-Down</option>
            <option value="LR">→ Left-Right</option>
            <option value="BT">↑ Bottom-Top</option>
            <option value="RL">← Right-Left</option>
        </select>
        
        <span class="spacer"></span>
        
        <button class="secondary" onclick="resetView()" title="뷰 리셋">🎯 Reset</button>
    </div>

    <!-- 메인 컨테이너 -->
    <div class="main-container">
        <!-- 그래프 뷰 -->
        <div id="graph-view">
            <div id="canvas-wrapper">
                <div id="mermaid-container">
                    <div id="mermaid-output"></div>
                </div>
            </div>
            
            <!-- 노드 정보 카드 -->
            <div id="info-card" class="info-card" style="display:none;">
                <button class="close-btn" onclick="closeInfoCard()">×</button>
                <h4 id="info-label"></h4>
                <p id="info-prompt"></p>
            </div>
            
            <!-- 줌 컨트롤 -->
            <div class="zoom-controls">
                <button onclick="zoomIn()" title="확대">+</button>
                <div class="zoom-level" id="zoomLevel">100%</div>
                <button onclick="zoomOut()" title="축소">−</button>
                <button onclick="fitToScreen()" title="화면 맞추기" style="font-size:12px;">⊞</button>
            </div>
        </div>

        <!-- 소스 뷰 -->
        <div id="source-view">
            <textarea id="source-editor" spellcheck="false"></textarea>
        </div>
    </div>

    <!-- 상태바 -->
    <div class="status-bar">
        <span><span class="status-dot"></span>Ready</span>
        <span id="nodeCount">Nodes: 0</span>
        <span class="spacer"></span>
        <span class="help-hint">🖱 드래그: 이동 • 스크롤: 줌 • 클릭: 노드 정보</span>
    </div>

    <!-- 노드 추가 모달 -->
    <div id="addNodeModal" class="modal-overlay">
        <div class="modal">
            <h3 id="modalTitle">새 노드 추가</h3>
            <input type="hidden" id="nodeType" />
            <label>노드 ID (영문, 숫자, _만 가능)</label>
            <input type="text" id="nodeId" placeholder="예: task_login_impl" />
            <label>레이블 (화면에 표시)</label>
            <input type="text" id="nodeLabel" placeholder="예: 로그인 구현 완료" />
            <label>설명 (상세 내용)</label>
            <textarea id="nodePrompt" placeholder="예: JWT 인증 기반 로그인 구현"></textarea>
            <label>연결할 이전 노드 (선택)</label>
            <select id="connectFrom">
                <option value="">연결 없음</option>
            </select>
            <div class="modal-buttons">
                <button class="secondary" onclick="closeAddNodeModal()">취소</button>
                <button onclick="confirmAddNode()">추가</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        let mermaidCode = '';
        let currentView = 'graph';
        let nodeMetadata = {}; // {nodeId: {type, prompt}}
        
        // 줌/패닝 상태
        let transform = { x: 50, y: 50, scale: 1 };
        let isPanning = false;
        let startPan = { x: 0, y: 0 };

        // Mermaid 초기화
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

        // 메타데이터 파싱 (주석에서 추출)
        function parseMetadata(code) {
            nodeMetadata = {};
            const metaRegex = /%% @(\\w+) \\[(\\w+(?:-\\w+)?)\\]: (.+)/g;
            let match;
            while ((match = metaRegex.exec(code)) !== null) {
                nodeMetadata[match[1]] = {
                    type: match[2],
                    prompt: match[3]
                };
            }
        }

        // 노드 목록 추출
        function extractNodes(code) {
            const nodes = [];
            // 노드 정의 패턴: nodeId["label"] 또는 nodeId(["label"]) 등
            const nodeRegex = /^\\s+(\\w+)(?:\\[|\\(|\\{)/gm;
            let match;
            while ((match = nodeRegex.exec(code)) !== null) {
                if (!nodes.includes(match[1]) && match[1] !== 'style' && match[1] !== 'flowchart') {
                    nodes.push(match[1]);
                }
            }
            return nodes;
        }

        // 방향 추출
        function extractDirection(code) {
            const match = code.match(/flowchart\\s+(TD|LR|BT|RL)/);
            return match ? match[1] : 'TD';
        }

        function updateTransform() {
            const wrapper = document.getElementById('canvas-wrapper');
            wrapper.style.transform = 'translate(' + transform.x + 'px, ' + transform.y + 'px) scale(' + transform.scale + ')';
            document.getElementById('zoomLevel').innerText = Math.round(transform.scale * 100) + '%';
        }

        async function render() {
            if (!mermaidCode.trim()) {
                document.getElementById('mermaid-output').innerHTML = '<p style="color:#888;padding:20px;">빈 파일입니다. 노드를 추가하세요.</p>';
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
            
            try {
                // 기존 SVG 제거
                const existingSvg = document.getElementById('mermaid-svg');
                if (existingSvg) existingSvg.remove();
                
                const { svg } = await mermaid.render('mermaid-svg', mermaidCode);
                container.innerHTML = svg;
                
                // 노드 클릭 이벤트
                nodes.forEach(nodeId => {
                    const nodeEl = container.querySelector('[id*="' + nodeId + '"]');
                    if (nodeEl) {
                        nodeEl.style.cursor = 'pointer';
                        nodeEl.onclick = (e) => {
                            e.stopPropagation();
                            showNodeInfo(nodeId);
                        };
                    }
                });

                document.getElementById('nodeCount').innerText = 'Nodes: ' + nodes.length;
            } catch (e) {
                container.innerHTML = '<p style="color:#ef4444;padding:20px;">렌더링 오류: ' + e.message + '</p>';
            }
        }

        function showNodeInfo(nodeId) {
            const meta = nodeMetadata[nodeId] || {};
            document.getElementById('info-card').style.display = 'block';
            document.getElementById('info-label').innerText = '[' + (meta.type || 'unknown').toUpperCase() + '] ' + nodeId;
            document.getElementById('info-prompt').innerText = meta.prompt || '(설명 없음)';
        }

        function closeInfoCard() {
            document.getElementById('info-card').style.display = 'none';
        }

        function updateConnectDropdown(nodes) {
            const select = document.getElementById('connectFrom');
            select.innerHTML = '<option value="">연결 없음</option>';
            nodes.forEach(id => {
                select.innerHTML += '<option value="' + id + '">' + id + '</option>';
            });
        }

        // === 뷰 전환 ===
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

        // 소스 에디터 변경 감지
        document.getElementById('source-editor').addEventListener('input', (e) => {
            mermaidCode = e.target.value;
            vscode.postMessage({ type: 'update', mermaidCode });
        });

        // === 줌/패닝 ===
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

        // === 방향 변경 ===
        function changeDirection() {
            const newDir = document.getElementById('flowDirection').value;
            mermaidCode = mermaidCode.replace(/flowchart\\s+(TD|LR|BT|RL)/, 'flowchart ' + newDir);
            vscode.postMessage({ type: 'update', mermaidCode });
            render();
        }

        // === 노드 추가 ===
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
            document.getElementById('modalTitle').innerText = '새 ' + type.toUpperCase() + ' 노드 추가';
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
            
            // 새 코드 생성
            let newCode = '';
            
            // 메타데이터 주석
            if (prompt) {
                newCode += '    %% @' + nodeId + ' [' + type + ']: ' + prompt.replace(/\\n/g, ' ') + '\\n';
            }
            
            // 노드 정의
            newCode += '    ' + nodeId + shape.open + label + shape.close + '\\n';
            
            // 엣지 (연결)
            if (connectFrom) {
                newCode += '    ' + connectFrom + ' --> ' + nodeId + '\\n';
            }
            
            // 스타일
            newCode += '    style ' + nodeId + ' ' + shape.style + '\\n';
            
            // 기존 코드에 추가
            if (!mermaidCode.trim()) {
                mermaidCode = 'flowchart TD\\n' + newCode;
            } else {
                // Styles 섹션 앞에 추가하거나 끝에 추가
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

        // === 메시지 핸들러 ===
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

        // 모달 닫기
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.onclick = (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    modal.classList.remove('active');
                }
            };
        });

        // Enter 키
        document.getElementById('nodeLabel').onkeydown = (e) => {
            if (e.key === 'Enter') confirmAddNode();
        };

        updateTransform();
    </script>
</body>
</html>`;
  }
}
