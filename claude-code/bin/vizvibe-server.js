#!/usr/bin/env node

/**
 * Viz Vibe - Local Browser Viewer
 * Renders vizvibe.mmd in a local browser with real-time updates
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// Configuration
// Port 5125 = VIZV (V=5, I=1, Z=2, V=5)
const PORT = process.env.VIZVIBE_PORT || 5125;
const MMD_FILE = process.argv[2] || path.join(process.cwd(), "vizvibe.mmd");

// Check if file exists
if (!fs.existsSync(MMD_FILE)) {
  console.error(`❌ File not found: ${MMD_FILE}`);
  console.error("");
  console.error("Run this command from a directory with vizvibe.mmd,");
  console.error("or provide the path: vizvibe view /path/to/vizvibe.mmd");
  process.exit(1);
}

// Store connected SSE clients
const clients = [];

// Read mermaid content
function getMermaidContent() {
  try {
    return fs.readFileSync(MMD_FILE, "utf-8");
  } catch (err) {
    return 'flowchart TD\n    error["Error reading file"]';
  }
}

// HTML template
function getHtml() {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Viz Vibe - ${path.basename(MMD_FILE)}</title>
    <meta charset="utf-8">
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-tertiary: #334155;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --border-color: #475569;
            --accent-blue: #3b82f6;
            --accent-green: #4ade80;
            --accent-purple: #a78bfa;
        }
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            height: 100vh; 
            overflow: hidden;
            display: flex; 
            flex-direction: column;
        }

        /* Toolbar */
        .toolbar {
            display: flex; 
            gap: 12px; 
            padding: 12px 20px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            align-items: center;
        }
        .toolbar h1 {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .toolbar h1 span { font-size: 20px; }
        .file-path {
            font-size: 12px;
            color: var(--text-muted);
            font-family: 'SF Mono', monospace;
            padding: 4px 10px;
            background: var(--bg-tertiary);
            border-radius: 4px;
        }
        .spacer { flex: 1; }
        .toolbar button {
            padding: 6px 14px;
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.15s;
        }
        .toolbar button:hover { 
            background: var(--accent-blue);
            border-color: var(--accent-blue);
        }
        .toolbar select {
            padding: 6px 12px;
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            font-size: 12px;
        }
        .connection-status {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: var(--text-muted);
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--accent-green);
        }
        .status-dot.disconnected { background: #ef4444; }

        /* Graph view */
        #graph-view { 
            flex: 1; 
            position: relative; 
            overflow: hidden;
            cursor: grab;
            background-image: radial-gradient(circle, var(--bg-tertiary) 0.5px, transparent 0.5px);
            background-size: 24px 24px;
            user-select: none;
        }
        #graph-view.grabbing { cursor: grabbing; }

        #canvas-wrapper {
            position: absolute;
            transform-origin: 0 0;
        }

        #mermaid-container {
            background: var(--bg-secondary);
            border-radius: 12px;
            padding: 24px;
            display: inline-block;
            border: 1px solid var(--border-color);
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        /* Node hover */
        .node rect, .node polygon, .node circle, .node ellipse {
            cursor: pointer;
            transition: all 0.15s;
        }
        .node:hover rect, .node:hover polygon, .node:hover circle {
            filter: brightness(1.2);
        }

        /* Zoom controls */
        .zoom-controls {
            position: absolute;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            z-index: 50;
        }
        .zoom-controls button {
            width: 36px;
            height: 36px;
            background: var(--bg-secondary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s;
        }
        .zoom-controls button:hover { 
            background: var(--accent-blue);
            border-color: var(--accent-blue);
        }
        .zoom-level {
            text-align: center;
            font-size: 11px;
            color: var(--text-muted);
            padding: 6px;
        }

        /* Node info card */
        .info-card {
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 16px 20px;
            max-width: 420px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            z-index: 50;
        }
        .info-card h4 {
            margin-bottom: 8px;
            color: var(--accent-blue);
            font-size: 14px;
        }
        .info-card p {
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
            white-space: pre-wrap;
        }
        .info-card .meta-info {
            display: flex;
            gap: 16px;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid var(--border-color);
            font-size: 11px;
            color: var(--text-muted);
        }
        .info-card .meta-info span {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .info-card .close-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            font-size: 16px;
        }
        .info-card .copy-btn {
            margin-top: 12px;
            padding: 6px 12px;
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        }
        .info-card .copy-btn:hover { 
            background: var(--accent-blue);
            border-color: var(--accent-blue);
        }

        /* Status bar */
        .status-bar {
            padding: 8px 20px;
            background: var(--bg-secondary);
            color: var(--text-muted);
            font-size: 11px;
            display: flex;
            gap: 24px;
            align-items: center;
            border-top: 1px solid var(--border-color);
        }
        .help-hint { color: var(--text-muted); }

        /* Toast notification */
        .toast {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--accent-blue);
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 1001;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .toast.show { opacity: 1; }

        /* Search box */
        .search-container { position: relative; }
        .search-box {
            display: none;
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 10px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 10px 14px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            z-index: 200;
            min-width: 300px;
        }
        .search-box.active { display: flex; gap: 10px; align-items: center; }
        .search-box input {
            flex: 1;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 6px 10px;
            outline: none;
            color: var(--text-primary);
            font-size: 12px;
            min-width: 180px;
        }
        .search-box input:focus { border-color: var(--accent-blue); }
        .search-info { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
        .search-nav { display: flex; gap: 2px; }
        .search-nav button {
            padding: 4px 8px;
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        }
        .search-nav button:hover { background: var(--accent-blue); }
        .search-close { background: none !important; border: none !important; color: var(--text-muted) !important; font-size: 16px !important; }

        /* Search highlighting */
        .node.search-match rect, .node.search-match polygon, .cluster.search-match rect {
            filter: brightness(1.2) drop-shadow(0 0 8px rgba(74, 222, 128, 0.6));
        }
        .node.search-current rect, .node.search-current polygon, .cluster.search-current rect {
            filter: brightness(1.4) drop-shadow(0 0 12px rgba(250, 204, 21, 0.8));
            stroke: #facc15 !important;
            stroke-width: 3px !important;
        }
        .node.search-dimmed, .cluster.search-dimmed { opacity: 0.3; }
        /* Initialization prompt overlay */
        .init-prompt-overlay {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            display: none;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.95) 100%);
            z-index: 1000;
            backdrop-filter: blur(4px);
        }
        .init-prompt-overlay.active { display: flex; }
        .init-prompt-card {
            background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
            border: 2px solid var(--accent-blue);
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
        .init-prompt-title {
            font-size: 28px;
            font-weight: 600;
            color: #f1f5f9;
            margin-bottom: 24px;
            line-height: 1.3;
        }
        .init-prompt-code {
            background: #0f172a;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 20px 24px;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 14px;
            color: #38bdf8;
            margin-bottom: 20px;
            user-select: all;
            cursor: pointer;
            transition: all 0.2s;
        }
        .init-prompt-code:hover {
            border-color: var(--accent-blue);
            background: #1e293b;
        }
        .language-selector {
            margin-bottom: 20px;
        }
        .language-dropdown {
            width: 100%;
            padding: 10px 14px;
            background: #0f172a;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            color: #f1f5f9;
            font-size: 14px;
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6,9 12,15 18,9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
            padding-right: 36px;
        }
        .language-dropdown:hover { border-color: var(--accent-blue); }
        .language-dropdown:focus { outline: none; border-color: var(--accent-blue); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }
    </style>
</head>
<body>
    <div class="toolbar">
        <h1><span>📊</span> Viz Vibe</h1>
        <span class="file-path">${path.basename(MMD_FILE)}</span>
        <span class="spacer"></span>
        
        <select id="flowDirection" onchange="changeDirection()">
            <option value="TD">↓ Top-Down</option>
            <option value="LR">→ Left-Right</option>
            <option value="BT">↑ Bottom-Top</option>
            <option value="RL">← Right-Left</option>
        </select>
        
        <div class="search-container">
            <button onclick="toggleSearch()">🔍 Search</button>
            <div id="search-box" class="search-box">
                <input type="text" id="search-input" placeholder="Search nodes..." autocomplete="off" />
                <span id="search-info" class="search-info"></span>
                <div class="search-nav">
                    <button onclick="navigateSearch(-1)">▲</button>
                    <button onclick="navigateSearch(1)">▼</button>
                </div>
                <button class="search-close" onclick="closeSearch()">×</button>
            </div>
        </div>
        
        <div class="connection-status">
            <span class="status-dot" id="connectionDot"></span>
            <span id="connectionText">Live</span>
        </div>
    </div>

    <div id="graph-view">
        <div id="canvas-wrapper">
            <div id="mermaid-container">
                <div id="mermaid-output"></div>
            </div>
        </div>

        <div id="info-card" class="info-card" style="display:none;">
            <button class="close-btn" onclick="closeInfoCard()">×</button>
            <h4 id="info-label"></h4>
            <p id="info-description"></p>
            <div id="info-meta" class="meta-info"></div>
            <button class="copy-btn" onclick="copyNodeInfo()">📋 Copy</button>
        </div>

        <div class="zoom-controls">
            <button onclick="zoomIn()">+</button>
            <div class="zoom-level" id="zoomLevel">100%</div>
            <button onclick="zoomOut()">−</button>
            <button onclick="fitToScreen()" style="font-size:12px;">⊞</button>
        </div>

        <!-- Initialization prompt overlay -->
        <div id="init-prompt-overlay" class="init-prompt-overlay">
            <div class="init-prompt-card">
                <div class="init-prompt-title">Copy this and<br/>Ask your AI agent to setup vizvibe! 👇</div>
                <div id="init-prompt-code" class="init-prompt-code" onclick="copyInitPrompt()">
                    "Please setup vizvibe for this project.<br/>Write the trajectory in my language."
                </div>
                <div class="language-selector">
                    <select id="langSelect" class="language-dropdown" onchange="updatePromptLanguage()">
                        <option value="">🌍 Select language (optional)</option>
                        <option value="English">🇺🇸 English</option>
                        <option value="Korean">🇰🇷 한국어 (Korean)</option>
                        <option value="Japanese">🇯🇵 日本語 (Japanese)</option>
                        <option value="Chinese (Simplified)">🇨🇳 简体中文 (Chinese Simplified)</option>
                        <option value="Chinese (Traditional)">🇹🇼 繁體中文 (Chinese Traditional)</option>
                        <option value="Spanish">🇪🇸 Español (Spanish)</option>
                        <option value="French">🇫🇷 Français (French)</option>
                        <option value="German">🇩🇪 Deutsch (German)</option>
                        <option value="Portuguese">🇧🇷 Português (Portuguese)</option>
                        <option value="Italian">🇮🇹 Italiano (Italian)</option>
                        <option value="Russian">🇷🇺 Русский (Russian)</option>
                        <option value="Arabic">🇸🇦 العربية (Arabic)</option>
                        <option value="Hindi">🇮🇳 हिन्दी (Hindi)</option>
                        <option value="Thai">🇹🇭 ไทย (Thai)</option>
                        <option value="Vietnamese">🇻🇳 Tiếng Việt (Vietnamese)</option>
                        <option value="Indonesian">🇮🇩 Bahasa Indonesia (Indonesian)</option>
                        <option value="Dutch">🇳🇱 Nederlands (Dutch)</option>
                        <option value="Polish">🇵🇱 Polski (Polish)</option>
                        <option value="Turkish">🇹🇷 Türkçe (Turkish)</option>
                        <option value="Ukrainian">🇺🇦 Українська (Ukrainian)</option>
                    </select>
                </div>
            </div>
        </div>
    </div>

    <div class="status-bar">
        <span id="nodeCount">Nodes: 0</span>
        <span class="spacer"></span>
        <span class="help-hint">🖱️ Scroll: Pan • Ctrl+Scroll: Zoom • Click: Info • Ctrl+F: Search</span>
    </div>

    <div id="toast" class="toast"></div>

    <script>
        let mermaidCode = '';
        let nodeMetadata = {};
        let lastActiveNodeId = null;
        let transform = { x: 50, y: 50, scale: 1 };
        let isPanning = false;
        let startPan = { x: 0, y: 0 };
        let selectedNodeId = null;
        let isFirstLoad = true;

        // Search state
        let searchResults = [];
        let currentSearchIndex = -1;
        let isSearchActive = false;

        // Initialize mermaid
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
        function parseMetadata(code) {
            nodeMetadata = {};
            lastActiveNodeId = null;

            const lastActiveMatch = code.match(/%% @lastActive:\\s*(\\w+)/);
            if (lastActiveMatch) lastActiveNodeId = lastActiveMatch[1];

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

        // Extract subgraphs
        function extractSubgraphs(code) {
            const subgraphs = [];
            const subgraphRegex = /^\\s*subgraph\\s+(\\w+)(?:\\s*\\[(.*)\\])?/gm;
            let match;
            while ((match = subgraphRegex.exec(code)) !== null) {
                subgraphs.push({ id: match[1], label: match[2] || match[1] });
            }
            return subgraphs;
        }

        // Extract direction
        function extractDirection(code) {
            const match = code.match(/flowchart\\s+(TD|LR|BT|RL)/);
            return match ? match[1] : 'TD';
        }

        function updateTransform() {
            const wrapper = document.getElementById('canvas-wrapper');
            wrapper.style.transform = \`translate(\${transform.x}px, \${transform.y}px) scale(\${transform.scale})\`;
            document.getElementById('zoomLevel').textContent = Math.round(transform.scale * 100) + '%';
        }

        // Extract nodes from mermaid code
        function extractNodes(code) {
            const nodes = [];
            const nodeRegex = /^\\s+(\\w+)(?:\\[|\\(|\\{)/gm;
            let match;
            while ((match = nodeRegex.exec(code)) !== null) {
                if (!nodes.includes(match[1]) && match[1] !== 'style' && match[1] !== 'flowchart' && match[1] !== 'subgraph') {
                    nodes.push(match[1]);
                }
            }
            return nodes;
        }

        // Check if trajectory is in template state
        function isTemplateState(nodes) {
            if (nodes.length === 0) return true;
            if (nodes.length === 1 && (nodes[0] === 'project_start' || nodes[0] === 'Start')) return true;
            return false;
        }

        // Show/hide init prompt overlay
        function updateInitPrompt(show) {
            const overlay = document.getElementById('init-prompt-overlay');
            if (overlay) {
                overlay.classList.toggle('active', show);
            }
        }

        // Copy init prompt
        function copyInitPrompt() {
            const text = getPromptText();
            navigator.clipboard.writeText(text).then(() => {
                showToast('📋 Prompt copied! Paste it in your AI chat.');
            });
        }

        // Get prompt text based on language
        function getPromptText() {
            const langSelect = document.getElementById('langSelect');
            const selectedLang = langSelect ? langSelect.value : '';
            if (selectedLang) {
                return 'Please setup vizvibe for this project. Write the trajectory in ' + selectedLang + '.';
            }
            return 'Please setup vizvibe for this project. Write the trajectory in my language.';
        }

        // Update prompt UI
        function updatePromptLanguage() {
            const codeEl = document.getElementById('init-prompt-code');
            if (codeEl) {
                const text = getPromptText().replace('Please setup vizvibe for this project.', 'Please setup vizvibe for this project.<br/>');
                codeEl.innerHTML = '"' + text + '"';
            }
        }

        // Add descriptions to node definitions
        function addDescriptionsToCode(code) {
            const lines = code.split('\\n');
            const result = [];
            for (const line of lines) {
                let newLine = line;
                if (!line.trim().startsWith('%') && !line.trim().startsWith('style')) {
                    for (const [nodeId, meta] of Object.entries(nodeMetadata)) {
                        const labelRegex = new RegExp(\`(\${nodeId}(?:\\\\[|\\\\(|\\\"|\\\\{).*?(?:\\\\]|\\\\)|\\\"|\\\\}))(?!.*<sub>)\`, 'g');
                        if (labelRegex.test(newLine)) {
                            let metaLabel = '';
                            if (meta.date || meta.author) {
                                const parts = [];
                                if (meta.date) parts.push('📅 ' + meta.date);
                                if (meta.author) parts.push('👤 ' + meta.author);
                                metaLabel = '<br/><sub style="font-size:9px;color:#64748b;">' + parts.join(' • ') + '</sub>';
                            }
                            if (metaLabel) {
                                newLine = newLine.replace(labelRegex, (match) => {
                                    const closeChar = match.slice(-1);
                                    const content = match.slice(0, -1);
                                    const hasSubAlready = match.includes('</sub>');
                                    if (hasSubAlready) {
                                        return match.replace('</sub>', '</sub>' + metaLabel);
                                    }
                                    return content + metaLabel + closeChar;
                                });
                            }
                            break;
                        }
                    }
                }
                result.push(newLine);
            }
            return result.join('\\n');
        }

        // Render mermaid
        async function render() {
            const output = document.getElementById('mermaid-output');
            if (!mermaidCode.trim()) {
                output.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Empty file. Add some nodes.</p>';
                updateInitPrompt(true);
                return;
            }

            parseMetadata(mermaidCode);
            const nodes = extractNodes(mermaidCode);
            
            // Show/hide init overlay
            updateInitPrompt(isTemplateState(nodes));

            const processedCode = addDescriptionsToCode(mermaidCode);

            try {
                const { svg } = await mermaid.render('mermaid-svg', processedCode);
                output.innerHTML = svg;

                // Node click handlers
                const nodes = output.querySelectorAll('.node, .cluster');
                nodes.forEach(node => {
                    node.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const nodeId = node.id.replace(/^flowchart-/, '').replace(/-[0-9]+$/, '');
                        showNodeInfo(nodeId);
                    });
                });

                // Count nodes
                document.getElementById('nodeCount').textContent = 'Nodes: ' + nodes.length;

                // Update direction dropdown
                document.getElementById('flowDirection').value = extractDirection(mermaidCode);

                // Focus on RECENT if first load
                if (isFirstLoad) {
                    isFirstLoad = false;
                    setTimeout(() => focusOnRecent(), 200);
                }
            } catch (err) {
                console.error('Mermaid render error:', err);
            }
        }

        // Get node info from DOM
        function getNodeInfoFromDom(nodeId) {
            const svg = document.getElementById('mermaid-svg');
            if (!svg) return null;

            const nodeEl = svg.querySelector(\`[id^="flowchart-\${nodeId}-"]\`) || 
                          svg.querySelector(\`#\${nodeId}\`) ||
                          svg.querySelector(\`.cluster[id="\${nodeId}"]\`);
            if (!nodeEl) return null;

            const labelEl = nodeEl.querySelector('.nodeLabel, .cluster-label');
            let rawHtml = labelEl ? labelEl.innerHTML : nodeId;

            // Parse label and description
            const titleMatch = rawHtml.match(/^([^<]+)/);
            const descMatch = rawHtml.match(/<sub>([\\s\\S]*?)<\\/sub>/);

            return {
                label: titleMatch ? titleMatch[1].trim() : nodeId,
                description: descMatch ? descMatch[1].replace(/<br\\/?>/gi, '\\n').trim() : ''
            };
        }

        // Show node info card
        function showNodeInfo(nodeId) {
            selectedNodeId = nodeId;
            const meta = nodeMetadata[nodeId] || {};
            const domInfo = getNodeInfoFromDom(nodeId) || { label: nodeId, description: '' };

            document.getElementById('info-label').textContent = domInfo.label;
            document.getElementById('info-description').textContent = domInfo.description || meta.prompt || '(No description)';

            // Meta info
            const metaEl = document.getElementById('info-meta');
            let metaHtml = \`<span>🏷️ \${meta.type || 'unknown'}</span>\`;
            metaHtml += \`<span>\${meta.state === 'closed' ? '✅ Closed' : '🟢 Open'}</span>\`;
            if (nodeId === lastActiveNodeId) metaHtml += '<span>⭐ Last Active</span>';
            if (meta.date) metaHtml += \`<span>📅 \${meta.date}</span>\`;
            if (meta.author) metaHtml += \`<span>👤 \${meta.author}</span>\`;
            metaEl.innerHTML = metaHtml;

            document.getElementById('info-card').style.display = 'block';
        }

        function closeInfoCard() {
            document.getElementById('info-card').style.display = 'none';
            selectedNodeId = null;
        }

        function copyNodeInfo() {
            if (!selectedNodeId) return;
            const meta = nodeMetadata[selectedNodeId] || {};
            const domInfo = getNodeInfoFromDom(selectedNodeId) || { label: selectedNodeId, description: '' };
            
            const text = \`Node: \${domInfo.label}\\nID: \${selectedNodeId}\\nType: \${meta.type || 'unknown'}\\nState: \${meta.state || 'opened'}\\nDescription: \${domInfo.description || meta.prompt || ''}\`;
            navigator.clipboard.writeText(text);
            showToast('Copied to clipboard!');
        }

        // Focus on RECENT subgraph
        function focusOnRecent() {
            const svg = document.getElementById('mermaid-svg');
            if (!svg) return;
            
            const recentCluster = svg.querySelector('.cluster[id="recent"]');
            const lastActiveNode = lastActiveNodeId ? 
                svg.querySelector(\`[id^="flowchart-\${lastActiveNodeId}-"]\`) : null;
            
            const target = recentCluster || lastActiveNode;
            if (!target) return;
            
            // Reset transform first to get accurate bounding rect
            transform.x = 0;
            transform.y = 0;
            transform.scale = 1;
            updateTransform();
            
            // Wait a frame for layout to settle
            requestAnimationFrame(() => {
                const rect = target.getBoundingClientRect();
                const container = document.getElementById('graph-view');
                const contRect = container.getBoundingClientRect();
                
                // Calculate center position with zoom
                transform.scale = 0.8;
                const targetCenterX = rect.left + rect.width / 2 - contRect.left;
                const targetCenterY = rect.top + rect.height / 2 - contRect.top;
                
                transform.x = (contRect.width / 2) - (targetCenterX * transform.scale);
                transform.y = (contRect.height / 2) - (targetCenterY * transform.scale);
                updateTransform();
            });
        }

        // Change direction
        function changeDirection() {
            const newDir = document.getElementById('flowDirection').value;
            const currentDir = extractDirection(mermaidCode);
            if (newDir !== currentDir) {
                mermaidCode = mermaidCode.replace(/flowchart\\s+(TD|LR|BT|RL)/, 'flowchart ' + newDir);
                render().then(() => setTimeout(focusOnRecent, 200));
            }
        }

        // Zoom controls
        function zoomIn() { transform.scale = Math.min(3, transform.scale * 1.2); updateTransform(); }
        function zoomOut() { transform.scale = Math.max(0.1, transform.scale / 1.2); updateTransform(); }
        function fitToScreen() {
            const container = document.getElementById('graph-view');
            const mermaidEl = document.getElementById('mermaid-container');
            const scaleX = (container.clientWidth - 100) / mermaidEl.offsetWidth;
            const scaleY = (container.clientHeight - 100) / mermaidEl.offsetHeight;
            transform.scale = Math.min(scaleX, scaleY, 1);
            transform.x = (container.clientWidth - mermaidEl.offsetWidth * transform.scale) / 2;
            transform.y = (container.clientHeight - mermaidEl.offsetHeight * transform.scale) / 2;
            updateTransform();
        }

        // Pan/zoom event handlers
        const graphView = document.getElementById('graph-view');
        
        graphView.addEventListener('mousedown', (e) => {
            if (e.target.closest('.node, .cluster, .zoom-controls, .info-card')) return;
            isPanning = true;
            graphView.classList.add('grabbing');
            startPan = { x: e.clientX - transform.x, y: e.clientY - transform.y };
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
            if (e.ctrlKey || e.metaKey) {
                // Zoom
                const intensity = 0.0075;
                const delta = -e.deltaY * intensity;
                const newScale = Math.min(3, Math.max(0.1, transform.scale * (1 + delta)));
                const rect = graphView.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;
                transform.x = mx - (mx - transform.x) * (newScale / transform.scale);
                transform.y = my - (my - transform.y) * (newScale / transform.scale);
                transform.scale = newScale;
            } else {
                // Pan
                transform.x -= e.deltaX;
                transform.y -= e.deltaY;
            }
            updateTransform();
        }, { passive: false });

        // Search functionality
        function toggleSearch() {
            const box = document.getElementById('search-box');
            const isActive = box.classList.contains('active');
            if (isActive) {
                closeSearch();
            } else {
                box.classList.add('active');
                document.getElementById('search-input').focus();
                isSearchActive = true;
            }
        }

        function closeSearch() {
            document.getElementById('search-box').classList.remove('active');
            document.getElementById('search-input').value = '';
            clearSearchHighlight();
            isSearchActive = false;
        }

        function clearSearchHighlight() {
            document.querySelectorAll('.search-match, .search-current, .search-dimmed').forEach(el => {
                el.classList.remove('search-match', 'search-current', 'search-dimmed');
            });
            searchResults = [];
            currentSearchIndex = -1;
            document.getElementById('search-info').textContent = '';
        }

        function performSearch(query) {
            clearSearchHighlight();
            if (!query.trim()) return;

            const q = query.toLowerCase();
            const svg = document.getElementById('mermaid-svg');
            if (!svg) return;

            // Search nodes
            svg.querySelectorAll('.node').forEach(node => {
                const labelEl = node.querySelector('.nodeLabel');
                if (labelEl && labelEl.textContent.toLowerCase().includes(q)) {
                    searchResults.push({ type: 'node', el: node });
                }
            });

            // Search subgraphs
            svg.querySelectorAll('.cluster').forEach(cluster => {
                const labelEl = cluster.querySelector('.cluster-label');
                if (labelEl && labelEl.textContent.toLowerCase().includes(q)) {
                    searchResults.push({ type: 'cluster', el: cluster });
                }
            });

            if (searchResults.length > 0) {
                // Dim non-matches
                svg.querySelectorAll('.node, .cluster').forEach(el => {
                    if (!searchResults.some(r => r.el === el)) {
                        el.classList.add('search-dimmed');
                    }
                });
                searchResults.forEach(r => r.el.classList.add('search-match'));
                currentSearchIndex = 0;
                focusCurrentSearchResult();
            }
            
            document.getElementById('search-info').textContent = searchResults.length > 0 
                ? \`\${currentSearchIndex + 1}/\${searchResults.length}\` 
                : 'No results';
        }

        function navigateSearch(dir) {
            if (searchResults.length === 0) return;
            currentSearchIndex = (currentSearchIndex + dir + searchResults.length) % searchResults.length;
            focusCurrentSearchResult();
        }

        function focusCurrentSearchResult() {
            searchResults.forEach(r => r.el.classList.remove('search-current'));
            const current = searchResults[currentSearchIndex];
            if (!current) return;
            
            current.el.classList.add('search-current');
            
            // Center on result - calculate delta like VS Code version
            const rect = current.el.getBoundingClientRect();
            const container = document.getElementById('graph-view');
            const contRect = container.getBoundingClientRect();
            
            // Calculate where the target center currently is in screen coordinates
            const targetCenterScreenX = rect.left + rect.width / 2;
            const targetCenterScreenY = rect.top + rect.height / 2;
            
            // Calculate where we want it (center of graph view)
            const targetScreenX = contRect.left + contRect.width / 2;
            const targetScreenY = contRect.top + contRect.height / 2;
            
            // Calculate the difference we need to move and apply delta
            transform.x += targetScreenX - targetCenterScreenX;
            transform.y += targetScreenY - targetCenterScreenY;
            updateTransform();
            
            document.getElementById('search-info').textContent = \`\${currentSearchIndex + 1}/\${searchResults.length}\`;
        }

        // Search input handlers
        document.getElementById('search-input').addEventListener('input', (e) => {
            performSearch(e.target.value);
        });

        document.getElementById('search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                navigateSearch(e.shiftKey ? -1 : 1);
            } else if (e.key === 'Escape') {
                closeSearch();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                toggleSearch();
            }
        });

        // Toast
        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
        }

        // SSE connection for live updates
        function connectSSE() {
            const eventSource = new EventSource('/events');
            
            eventSource.onmessage = (e) => {
                if (e.data.startsWith('UPDATE:')) {
                    mermaidCode = e.data.slice(7);
                    render();
                }
            };
            
            eventSource.onopen = () => {
                document.getElementById('connectionDot').classList.remove('disconnected');
                document.getElementById('connectionText').textContent = 'Live';
            };
            
            eventSource.onerror = () => {
                document.getElementById('connectionDot').classList.add('disconnected');
                document.getElementById('connectionText').textContent = 'Disconnected';
                setTimeout(connectSSE, 3000);
            };
        }

        // Initial load
        fetch('/content')
            .then(res => res.text())
            .then(code => {
                mermaidCode = code;
                render();
            });

        connectSSE();
    </script>
</body>
</html>`;
}

// Canvas-based HTML template (for better performance with large graphs)
function getCanvasHtml() {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Viz Vibe - ${path.basename(MMD_FILE)}</title>
    <meta charset="utf-8">
    <script src="https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-tertiary: #334155;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --border-color: #475569;
            --accent-blue: #3b82f6;
            --accent-green: #4ade80;
            --accent-purple: #a78bfa;
        }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            height: 100vh; 
            overflow: hidden;
            display: flex; 
            flex-direction: column;
        }
        .toolbar {
            display: flex; gap: 12px; padding: 12px 20px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            align-items: center; z-index: 100;
        }
        .toolbar h1 { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .toolbar h1 span { font-size: 20px; }
        .file-path { font-size: 12px; color: var(--text-muted); font-family: monospace; padding: 4px 10px; background: var(--bg-tertiary); border-radius: 4px; }
        .spacer { flex: 1; }
        .toolbar button, .toolbar select {
            padding: 6px 14px; background: var(--bg-tertiary); color: var(--text-primary);
            border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 12px;
        }
        .toolbar button:hover { background: var(--accent-blue); border-color: var(--accent-blue); }
        .connection-status { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted); }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-green); }
        .status-dot.disconnected { background: #ef4444; }
        #graph-view { flex: 1; position: relative; overflow: hidden; }
        #graph-canvas { display: block; cursor: grab; }
        #graph-canvas.grabbing { cursor: grabbing; }
        .info-card {
            position: absolute; bottom: 20px; left: 20px;
            background: var(--bg-secondary); border: 1px solid var(--border-color);
            border-radius: 10px; padding: 16px 20px; max-width: 420px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4); z-index: 50; display: none;
        }
        .info-card h4 { margin-bottom: 8px; color: var(--accent-blue); font-size: 14px; }
        .info-card p { font-size: 12px; color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap; }
        .info-card .meta-info { display: flex; gap: 16px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color); font-size: 11px; color: var(--text-muted); }
        .info-card .close-btn { position: absolute; top: 10px; right: 10px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; }
        .info-card .copy-btn { margin-top: 12px; padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 11px; }
        .zoom-controls { position: absolute; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 6px; z-index: 50; }
        .zoom-controls button { width: 36px; height: 36px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .zoom-controls button:hover { background: var(--accent-blue); }
        .zoom-level { text-align: center; font-size: 11px; color: var(--text-muted); padding: 6px; }
        .status-bar { padding: 8px 20px; background: var(--bg-secondary); color: var(--text-muted); font-size: 11px; display: flex; gap: 24px; align-items: center; border-top: 1px solid var(--border-color); }
        .toast { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: var(--accent-blue); color: white; padding: 10px 20px; border-radius: 6px; font-size: 12px; z-index: 1001; opacity: 0; transition: opacity 0.3s; }
        .toast.show { opacity: 1; }
        .search-container { position: relative; }
        .search-box { display: none; position: absolute; top: 100%; right: 0; margin-top: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); z-index: 200; min-width: 300px; }
        .search-box.active { display: flex; gap: 10px; align-items: center; }
        .search-box input { flex: 1; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px 10px; outline: none; color: var(--text-primary); font-size: 12px; min-width: 180px; }
        .search-info { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
        .search-nav button { padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 11px; color: var(--text-primary); }
        .renderer-badge { font-size: 10px; padding: 2px 6px; background: var(--accent-purple); color: white; border-radius: 4px; margin-left: 8px; }
    </style>
</head>
<body>
    <div class="toolbar">
        <h1><span>📊</span> Viz Vibe <span class="renderer-badge">Canvas</span></h1>
        <span class="file-path">${path.basename(MMD_FILE)}</span>
        <span class="spacer"></span>
        <select id="flowDirection" onchange="changeDirection()">
            <option value="TD">↓ Top-Down</option>
            <option value="LR">→ Left-Right</option>
        </select>
        <div class="search-container">
            <button onclick="toggleSearch()">🔍 Search</button>
            <div id="search-box" class="search-box">
                <input type="text" id="search-input" placeholder="Search nodes..." autocomplete="off" />
                <span id="search-info" class="search-info"></span>
                <div class="search-nav">
                    <button onclick="navigateSearch(-1)">▲</button>
                    <button onclick="navigateSearch(1)">▼</button>
                </div>
                <button style="background:none;border:none;color:var(--text-muted);font-size:16px;cursor:pointer;" onclick="closeSearch()">×</button>
            </div>
        </div>
        <a href="?renderer=svg" style="font-size:11px;color:var(--text-muted);text-decoration:none;">Switch to SVG</a>
        <div class="connection-status">
            <span class="status-dot" id="connectionDot"></span>
            <span id="connectionText">Live</span>
        </div>
    </div>
    <div id="graph-view">
        <canvas id="graph-canvas"></canvas>
        <div id="info-card" class="info-card">
            <button class="close-btn" onclick="closeInfoCard()">×</button>
            <h4 id="info-label"></h4>
            <p id="info-description"></p>
            <div id="info-meta" class="meta-info"></div>
            <button class="copy-btn" onclick="copyNodeInfo()">📋 Copy</button>
        </div>
        <div class="zoom-controls">
            <button onclick="zoomIn()">+</button>
            <div class="zoom-level" id="zoomLevel">100%</div>
            <button onclick="zoomOut()">−</button>
            <button onclick="fitToScreen()" style="font-size:12px;">⊞</button>
        </div>
    </div>
    <div class="status-bar">
        <span id="nodeCount">Nodes: 0</span>
        <span class="spacer"></span>
        <span>🖱️ Scroll: Pan • Ctrl+Scroll: Zoom • Click: Info • Ctrl+F: Search</span>
    </div>
    <div id="toast" class="toast"></div>

    <script>
        let mermaidCode = '';
        let nodes = [];
        let edges = [];
        let subgraphs = [];
        let nodeMetadata = {};
        let lastActiveNodeId = null;
        let selectedNode = null;
        let transform = { x: 50, y: 50, scale: 1 };
        let isPanning = false;
        let startPan = { x: 0, y: 0 };
        let flowDirection = 'TD';
        let searchResults = [];
        let currentSearchIndex = -1;
        
        // Performance optimization flags
        let renderPending = false;
        let eventSource = null; // Track SSE connection for cleanup

        const canvas = document.getElementById('graph-canvas');
        const ctx = canvas.getContext('2d');
        const graphView = document.getElementById('graph-view');

        // Resize canvas with debouncing
        let resizeTimeout = null;
        function resizeCanvas() {
            canvas.width = graphView.clientWidth;
            canvas.height = graphView.clientHeight;
            render();
        }
        window.addEventListener('resize', () => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(resizeCanvas, 100);
        });

        // Parse mermaid code
        function parseMermaid(code) {
            nodes = [];
            edges = [];
            subgraphs = [];
            nodeMetadata = {};
            lastActiveNodeId = null;

            // Direction
            const dirMatch = code.match(/flowchart\\s+(TD|LR|BT|RL)/);
            flowDirection = dirMatch ? dirMatch[1] : 'TD';
            document.getElementById('flowDirection').value = flowDirection;

            // Last active
            const lastActiveMatch = code.match(/%% @lastActive:\\s*(\\w+)/);
            if (lastActiveMatch) lastActiveNodeId = lastActiveMatch[1];

            // Metadata
            const metaRegex = /%% @(\\w+) \\[([\\w-]+)(?:,\\s*(\\w+))?(?:,\\s*([\\d-]+))?(?:,\\s*([\\w@.-]+))?\\]/g;
            let match;
            while ((match = metaRegex.exec(code)) !== null) {
                nodeMetadata[match[1]] = {
                    type: match[2],
                    state: match[3] || 'opened',
                    date: match[4] || null,
                    author: match[5] || null
                };
            }

            // Subgraphs
            const subgraphRegex = /subgraph\\s+(\\w+)\\s*\\[([^\\]]+)\\]/g;
            while ((match = subgraphRegex.exec(code)) !== null) {
                subgraphs.push({ id: match[1], label: match[2] });
            }

            // Nodes - various formats
            const nodePatterns = [
                /(\\w+)\\["([^"]+)"\\]/g,
                /(\\w+)\\("([^"]+)"\\)/g,
                /(\\w+)\\[([^\\]]+)\\]/g
            ];
            const seenNodes = new Set();
            nodePatterns.forEach(regex => {
                regex.lastIndex = 0;
                while ((match = regex.exec(code)) !== null) {
                    const id = match[1];
                    if (!seenNodes.has(id) && id !== 'style' && id !== 'flowchart' && id !== 'subgraph' && id !== 'end') {
                        seenNodes.add(id);
                        let label = match[2].replace(/<br\\/>/g, '\\n').replace(/<sub>/g, '\\n').replace(/<\\/sub>/g, '');
                        nodes.push({ id, label, x: 0, y: 0, width: 0, height: 0 });
                    }
                }
            });

            // Edges
            const edgeRegex = /(\\w+)\\s*(-[.-]?>)\\s*(\\w+)/g;
            while ((match = edgeRegex.exec(code)) !== null) {
                const isDashed = match[2].includes('.');
                edges.push({ from: match[1], to: match[3], dashed: isDashed });
            }

            layoutNodes();
        }

        // Simple layout algorithm using dagre
        function layoutNodes() {
            const nodeMap = {};
            nodes.forEach(n => nodeMap[n.id] = n);

            // Calculate text dimensions
            ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
            nodes.forEach(node => {
                const lines = node.label.split('\\n');
                let maxWidth = 0;
                lines.forEach(line => {
                    const w = ctx.measureText(line).width;
                    if (w > maxWidth) maxWidth = w;
                });
                node.width = Math.min(Math.max(maxWidth + 40, 140), 280);
                node.height = Math.max(lines.length * 16 + 30, 60);
            });

            // Use dagre for layout
            const g = new dagre.graphlib.Graph();
            g.setGraph({ 
                rankdir: flowDirection === 'LR' ? 'LR' : 'TB',
                nodesep: 50,
                ranksep: 80,
                marginx: 50,
                marginy: 50
            });
            g.setDefaultEdgeLabel(() => ({}));

            // Add nodes to dagre
            nodes.forEach(node => {
                g.setNode(node.id, { width: node.width, height: node.height });
            });

            // Add edges to dagre
            edges.forEach(edge => {
                if (nodeMap[edge.from] && nodeMap[edge.to]) {
                    g.setEdge(edge.from, edge.to);
                }
            });

            // Run dagre layout
            dagre.layout(g);

            // Apply positions from dagre
            nodes.forEach(node => {
                const n = g.node(node.id);
                if (n) {
                    node.x = n.x - node.width / 2;
                    node.y = n.y - node.height / 2;
                }
            });
        }

        // Render - wrapped with requestAnimationFrame for performance
        function scheduleRender() {
            if (!renderPending) {
                renderPending = true;
                requestAnimationFrame(() => {
                    renderPending = false;
                    renderImmediate();
                });
            }
        }
        
        // Alias for backward compatibility - most calls should use scheduleRender
        function render() {
            scheduleRender();
        }
        
        // Actual render implementation
        function renderImmediate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(transform.x, transform.y);
            ctx.scale(transform.scale, transform.scale);

            // Draw edges
            const nodeMap = {};
            nodes.forEach(n => nodeMap[n.id] = n);
            edges.forEach(edge => {
                const from = nodeMap[edge.from];
                const to = nodeMap[edge.to];
                if (!from || !to) return;
                
                ctx.beginPath();
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 1.5;
                if (edge.dashed) ctx.setLineDash([5, 5]);
                else ctx.setLineDash([]);
                
                const fromX = from.x + from.width / 2;
                const fromY = from.y + from.height;
                const toX = to.x + to.width / 2;
                const toY = to.y;
                
                ctx.moveTo(fromX, fromY);
                ctx.bezierCurveTo(fromX, fromY + 30, toX, toY - 30, toX, toY);
                ctx.stroke();
                
                // Arrow
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(toX, toY);
                ctx.lineTo(toX - 5, toY - 8);
                ctx.lineTo(toX + 5, toY - 8);
                ctx.closePath();
                ctx.fillStyle = '#475569';
                ctx.fill();
            });

            // Draw nodes
            nodes.forEach(node => {
                const meta = nodeMetadata[node.id] || {};
                const isOpen = meta.state !== 'closed';
                const isLastActive = node.id === lastActiveNodeId;
                const isSearchMatch = searchResults.some(r => r.id === node.id);
                const isCurrentSearch = searchResults[currentSearchIndex]?.id === node.id;

                // Node background
                ctx.fillStyle = isLastActive ? '#2d1f4e' : '#1a1a2e';
                ctx.strokeStyle = isCurrentSearch ? '#facc15' : isSearchMatch ? '#4ade80' : 
                                  isLastActive ? '#c084fc' : isOpen ? '#4ade80' : '#a78bfa';
                ctx.lineWidth = isCurrentSearch ? 3 : isLastActive ? 2 : 1;
                
                roundRect(ctx, node.x, node.y, node.width, node.height, 8);
                ctx.fill();
                ctx.stroke();

                // Node text
                ctx.fillStyle = isOpen ? '#86efac' : '#c4b5fd';
                ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                const lines = node.label.split('\\n');
                const lineHeight = 14;
                const startY = node.y + node.height / 2 - (lines.length - 1) * lineHeight / 2;
                lines.forEach((line, i) => {
                    const truncated = line.length > 35 ? line.slice(0, 32) + '...' : line;
                    ctx.fillText(truncated, node.x + node.width / 2, startY + i * lineHeight);
                });
            });

            ctx.restore();
            document.getElementById('nodeCount').textContent = 'Nodes: ' + nodes.length;
            document.getElementById('zoomLevel').textContent = Math.round(transform.scale * 100) + '%';
        }

        function roundRect(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }

        // Hit test
        function getNodeAt(screenX, screenY) {
            const x = (screenX - transform.x) / transform.scale;
            const y = (screenY - transform.y) / transform.scale;
            for (let i = nodes.length - 1; i >= 0; i--) {
                const n = nodes[i];
                if (x >= n.x && x <= n.x + n.width && y >= n.y && y <= n.y + n.height) {
                    return n;
                }
            }
            return null;
        }

        // Events
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
            if (node) {
                showNodeInfo(node);
            } else {
                isPanning = true;
                canvas.classList.add('grabbing');
                startPan = { x: e.clientX - transform.x, y: e.clientY - transform.y };
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isPanning) {
                transform.x = e.clientX - startPan.x;
                transform.y = e.clientY - startPan.y;
                render();
            }
        });

        canvas.addEventListener('mouseup', () => {
            isPanning = false;
            canvas.classList.remove('grabbing');
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            if (e.ctrlKey || e.metaKey) {
                const intensity = 0.0075;
                const delta = -e.deltaY * intensity;
                const newScale = Math.min(3, Math.max(0.1, transform.scale * (1 + delta)));
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;
                transform.x = mx - (mx - transform.x) * (newScale / transform.scale);
                transform.y = my - (my - transform.y) * (newScale / transform.scale);
                transform.scale = newScale;
            } else {
                transform.x -= e.deltaX;
                transform.y -= e.deltaY;
            }
            render();
        }, { passive: false });

        // Node info card
        function showNodeInfo(node) {
            selectedNode = node;
            const meta = nodeMetadata[node.id] || {};
            document.getElementById('info-label').textContent = node.label.split('\\n')[0];
            document.getElementById('info-description').textContent = node.label.split('\\n').slice(1).join('\\n') || '(No description)';
            
            let metaHtml = '<span>🏷️ ' + (meta.type || 'unknown') + '</span>';
            metaHtml += '<span>' + (meta.state === 'closed' ? '✅ Closed' : '🟢 Open') + '</span>';
            if (node.id === lastActiveNodeId) metaHtml += '<span>⭐ Last Active</span>';
            if (meta.date) metaHtml += '<span>📅 ' + meta.date + '</span>';
            document.getElementById('info-meta').innerHTML = metaHtml;
            document.getElementById('info-card').style.display = 'block';
        }

        function closeInfoCard() {
            document.getElementById('info-card').style.display = 'none';
            selectedNode = null;
        }

        function copyNodeInfo() {
            if (!selectedNode) return;
            const meta = nodeMetadata[selectedNode.id] || {};
            const text = 'Node: ' + selectedNode.label.split('\\n')[0] + '\\nID: ' + selectedNode.id + '\\nState: ' + (meta.state || 'opened');
            navigator.clipboard.writeText(text);
            showToast('Copied!');
        }

        // Zoom controls
        function zoomIn() { transform.scale = Math.min(3, transform.scale * 1.2); render(); }
        function zoomOut() { transform.scale = Math.max(0.1, transform.scale / 1.2); render(); }
        function fitToScreen() {
            if (nodes.length === 0) return;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            nodes.forEach(n => {
                minX = Math.min(minX, n.x);
                minY = Math.min(minY, n.y);
                maxX = Math.max(maxX, n.x + n.width);
                maxY = Math.max(maxY, n.y + n.height);
            });
            const w = maxX - minX + 100;
            const h = maxY - minY + 100;
            const scaleX = canvas.width / w;
            const scaleY = canvas.height / h;
            transform.scale = Math.min(scaleX, scaleY, 1);
            transform.x = (canvas.width - w * transform.scale) / 2 - minX * transform.scale + 50;
            transform.y = (canvas.height - h * transform.scale) / 2 - minY * transform.scale + 50;
            render();
        }

        function changeDirection() {
            const newDir = document.getElementById('flowDirection').value;
            if (newDir !== flowDirection) {
                mermaidCode = mermaidCode.replace(/flowchart\\s+(TD|LR|BT|RL)/, 'flowchart ' + newDir);
                parseMermaid(mermaidCode);
                render();
                setTimeout(fitToScreen, 100);
            }
        }

        // Search
        function toggleSearch() {
            const box = document.getElementById('search-box');
            if (box.classList.contains('active')) closeSearch();
            else { box.classList.add('active'); document.getElementById('search-input').focus(); }
        }
        function closeSearch() {
            document.getElementById('search-box').classList.remove('active');
            document.getElementById('search-input').value = '';
            searchResults = [];
            currentSearchIndex = -1;
            render();
        }
        function performSearch(query) {
            searchResults = [];
            if (!query.trim()) { render(); return; }
            const q = query.toLowerCase();
            nodes.forEach(n => {
                if (n.label.toLowerCase().includes(q)) searchResults.push(n);
            });
            currentSearchIndex = searchResults.length > 0 ? 0 : -1;
            if (currentSearchIndex >= 0) focusOnNode(searchResults[0]);
            document.getElementById('search-info').textContent = searchResults.length > 0 ? (currentSearchIndex + 1) + '/' + searchResults.length : 'No results';
            render();
        }
        function navigateSearch(dir) {
            if (searchResults.length === 0) return;
            currentSearchIndex = (currentSearchIndex + dir + searchResults.length) % searchResults.length;
            focusOnNode(searchResults[currentSearchIndex]);
            document.getElementById('search-info').textContent = (currentSearchIndex + 1) + '/' + searchResults.length;
            render();
        }
        function focusOnNode(node) {
            const targetX = node.x + node.width / 2;
            const targetY = node.y + node.height / 2;
            transform.x = canvas.width / 2 - targetX * transform.scale;
            transform.y = canvas.height / 2 - targetY * transform.scale;
        }
        document.getElementById('search-input').addEventListener('input', (e) => performSearch(e.target.value));
        document.getElementById('search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') navigateSearch(e.shiftKey ? -1 : 1);
            else if (e.key === 'Escape') closeSearch();
        });
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); toggleSearch(); }
        });

        function showToast(msg) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
        }

        // SSE - with proper cleanup to prevent memory leaks
        function connectSSE() {
            // Clean up existing connection if any
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            
            eventSource = new EventSource('/events');
            eventSource.onmessage = (e) => {
                if (e.data.startsWith('UPDATE:')) {
                    mermaidCode = e.data.slice(7);
                    parseMermaid(mermaidCode);
                    render();
                }
            };
            eventSource.onopen = () => {
                document.getElementById('connectionDot').classList.remove('disconnected');
                document.getElementById('connectionText').textContent = 'Live';
            };
            eventSource.onerror = () => {
                document.getElementById('connectionDot').classList.add('disconnected');
                document.getElementById('connectionText').textContent = 'Disconnected';
                // Clean up and reconnect
                if (eventSource) {
                    eventSource.close();
                    eventSource = null;
                }
                setTimeout(connectSSE, 3000);
            };
        }

        // Cleanup on page unload to prevent memory leaks
        window.addEventListener('beforeunload', () => {
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
        });

        // Init
        fetch('/content').then(r => r.text()).then(code => {
            mermaidCode = code;
            resizeCanvas();
            parseMermaid(mermaidCode);
            render();
            setTimeout(fitToScreen, 100);
        });
        connectSSE();
    </script>
</body>
</html>`;
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const renderer = url.searchParams.get('renderer') || 'canvas'; // Default to canvas
  
  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    if (renderer === 'svg') {
      res.end(getHtml()); // Original SVG renderer
    } else {
      res.end(getCanvasHtml()); // New Canvas renderer
    }
  } else if (url.pathname === "/content") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(getMermaidContent());
  } else if (url.pathname === "/events") {
    // Server-Sent Events for live updates
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    clients.push(res);

    req.on("close", () => {
      const index = clients.indexOf(res);
      if (index !== -1) clients.splice(index, 1);
    });
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

// Watch file for changes
let debounceTimeout;
fs.watch(MMD_FILE, (eventType) => {
  if (eventType === "change") {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      const content = getMermaidContent();
      clients.forEach((client) => {
        client.write(`data: UPDATE:${content}\n\n`);
      });
    }, 100);
  }
});

// Start server
server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║          Viz Vibe - Browser Viewer                         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`📊 Watching: ${MMD_FILE}`);
  console.log(`🌐 Server:   ${url}`);
  console.log("");
  console.log("🔄 Live reload enabled - edit vizvibe.mmd and see changes!");
  console.log("");
  console.log("Press Ctrl+C to stop the server.");
  console.log("");

  // Open browser
  const openCommand =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${openCommand} ${url}`);
});
