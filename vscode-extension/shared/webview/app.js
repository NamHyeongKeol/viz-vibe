/**
 * Viz Vibe - Main Application Logic
 * 
 * This file contains the core application logic for the Viz Vibe editor.
 * It's platform-agnostic and uses the Platform abstraction layer for communication.
 */

(function() {
  'use strict';
  
  // Initialize platform
  const Platform = window.VizVibePlatform.init();
  
  // Application state
  let mermaidCode = '';
  let currentView = 'graph';
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
  
  // Edge connections
  let edgeConnections = [];
  let lastActiveNodeId = null;

  // Node shapes configuration
  const nodeShapes = {
    'start': { open: '(["', close: '"])', style: 'fill:#64748b,stroke:#475569,color:#fff,stroke-width:1px' },
    'end': { open: '(["', close: '"])', style: 'fill:#64748b,stroke:#475569,color:#fff,stroke-width:2px' },
    'ai-task': { open: '["', close: '"]', style: 'fill:#334155,stroke:#475569,color:#f8fafc,stroke-width:1px' },
    'human-task': { open: '["', close: '"]', style: 'fill:#1e293b,stroke:#6366f1,color:#f8fafc,stroke-width:2px' },
    'condition': { open: '{"', close: '"}', style: 'fill:#0f172a,stroke:#f59e0b,color:#fbbf24,stroke-width:2px' },
    'blocker': { open: '{{"', close: '"}}', style: 'fill:#450a0a,stroke:#dc2626,color:#fca5a5,stroke-width:2px' }
  };

  // ============================================
  // Mermaid Initialization
  // ============================================
  
  function initMermaid() {
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
  }

  // ============================================
  // Parsing Functions
  // ============================================
  
  function parseMetadata(code) {
    nodeMetadata = {};
    lastActiveNodeId = null;

    // Parse lastActive
    const lastActiveMatch = code.match(/%% @lastActive:\s*(\w+)/);
    if (lastActiveMatch) {
      lastActiveNodeId = lastActiveMatch[1];
    }

    // Support both old format [type] and new format [type, state]
    const metaRegex = /%% @(\w+) \[([\w-]+)(?:,\s*(\w+))?\]: (.+)/g;
    let match;
    while ((match = metaRegex.exec(code)) !== null) {
      nodeMetadata[match[1]] = {
        type: match[2],
        state: match[3] || 'opened',
        prompt: match[4]
      };
    }
  }

  function extractNodes(code) {
    const nodes = [];
    // Node definition pattern: nodeId["label"] or nodeId(["label"]) etc
    const nodeRegex = /^\s+(\w+)(?:\[|\(|\{)/gm;
    let match;
    while ((match = nodeRegex.exec(code)) !== null) {
      if (!nodes.includes(match[1]) && match[1] !== 'style' && match[1] !== 'flowchart') {
        nodes.push(match[1]);
      }
    }
    return nodes;
  }

  function extractDirection(code) {
    const match = code.match(/flowchart\s+(TD|LR|BT|RL)/);
    return match ? match[1] : 'TD';
  }

  function parseEdgeConnections(code) {
    edgeConnections = [];
    const edgeRegex = /(\w+)\s*(?:-->|-.->|==>|--o|--x)\s*(\w+)/g;
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

  // ============================================
  // Transform & View Functions
  // ============================================
  
  function updateTransform() {
    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
    document.getElementById('zoomLevel').innerText = Math.round(transform.scale * 100) + '%';
  }

  function addDescriptionsToCode(code) {
    const lines = code.split('\n');
    const result = [];
    for (const line of lines) {
      let newLine = line;
      if (!line.trim().startsWith('%') && !line.trim().startsWith('style')) {
        for (const [nodeId, meta] of Object.entries(nodeMetadata)) {
          if (!meta.prompt) continue;
          const nodePattern = new RegExp('^\\s*' + nodeId + '\\s*[\\(\\[]');
          if (nodePattern.test(line) && line.includes('"')) {
            const lastQuoteIdx = line.lastIndexOf('"');
            if (lastQuoteIdx > 0) {
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
    return result.join('\n');
  }

  // ============================================
  // Render Function
  // ============================================
  
  async function render() {
    if (!mermaidCode.trim()) {
      document.getElementById('mermaid-output').innerHTML = '<p style="color:#888;padding:20px;">Empty file. Add some nodes.</p>';
      return;
    }

    parseMetadata(mermaidCode);
    const nodes = extractNodes(mermaidCode);

    // Sync direction dropdown
    const direction = extractDirection(mermaidCode);
    document.getElementById('flowDirection').value = direction;

    // Update connect dropdown
    updateConnectDropdown(nodes);

    const container = document.getElementById('mermaid-output');
    const codeWithDescriptions = addDescriptionsToCode(mermaidCode);

    try {
      // Remove existing SVG
      const existingSvg = document.getElementById('mermaid-svg');
      if (existingSvg) existingSvg.remove();

      const { svg } = await mermaid.render('mermaid-svg', codeWithDescriptions);
      container.innerHTML = svg;

      // Set up node interactions
      const nodeElements = container.querySelectorAll('.node');
      nodeElements.forEach(nodeEl => {
        const elId = nodeEl.id || '';
        let foundNodeId = null;

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
          nodeEl.setAttribute('transform', `${baseTransform} translate(${offset.x},${offset.y})`);
        }

        // Node drag handlers
        nodeEl.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          isDraggingNode = true;
          draggingNodeId = nodeId;
          nodeEl.classList.add('dragging');
          
          const currentOffset = nodeOffsets[nodeId] || { x: 0, y: 0 };
          dragStartPos = {
            x: e.clientX / transform.scale - currentOffset.x,
            y: e.clientY / transform.scale - currentOffset.y
          };
        });

        // Single click - show info
        let dragDistance = 0;
        nodeEl.addEventListener('click', (e) => {
          if (dragDistance > 5) {
            dragDistance = 0;
            return;
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
      container.innerHTML = `<p style="color:#ef4444;padding:20px;">Render error: ${e.message}</p>`;
    }
  }

  // ============================================
  // Node Info Functions
  // ============================================
  
  function extractNodeLabel(nodeEl, nodeId) {
    const textEl = nodeEl ? nodeEl.querySelector('.nodeLabel, text, foreignObject') : null;
    if (textEl) {
      let html = textEl.innerHTML || '';
      html = html.replace(/<br\s*\/?>/gi, '\n');
      html = html.replace(/<[^>]+>/g, '');
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
    
    const container = document.getElementById('mermaid-output');
    let nodeEl = null;
    container.querySelectorAll('.node').forEach(el => {
      if (el.id && (el.id.includes(nodeId) || el.id.includes('flowchart-' + nodeId))) {
        nodeEl = el;
      }
    });
    extractNodeLabel(nodeEl, nodeId);

    const isRecent = (nodeId === lastActiveNodeId);
    const state = meta.state || 'opened';
    let statusText = state === 'closed' ? '✓ Closed' : '○ Open';
    if (isRecent) statusText += '  •  ⭐ Recent';

    document.getElementById('info-card').style.display = 'block';
    document.getElementById('info-label').innerText = selectedNodeLabel;
    document.getElementById('info-prompt').innerText = statusText + '\n\n' + (meta.prompt || '');
  }

  function closeInfoCard() {
    document.getElementById('info-card').style.display = 'none';
  }

  // ============================================
  // Context Menu Functions
  // ============================================
  
  function showContextMenu(x, y) {
    const menu = document.getElementById('context-menu');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('active');
  }

  function hideContextMenu() {
    document.getElementById('context-menu').classList.remove('active');
  }

  // ============================================
  // Copy Functions
  // ============================================
  
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
    copyToClipboard(selectedNodeLabel);
  }

  function copyNodeInfo() {
    copyNodeAll();
  }

  // ============================================
  // View Switching
  // ============================================
  
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

  function updateConnectDropdown(nodes) {
    const select = document.getElementById('connectFrom');
    select.innerHTML = '<option value="">No connection</option>';
    nodes.forEach(id => {
      select.innerHTML += `<option value="${id}">${id}</option>`;
    });
  }

  // ============================================
  // Zoom & Pan Functions
  // ============================================
  
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

  // ============================================
  // Direction & Node Creation
  // ============================================
  
  function changeDirection() {
    const newDir = document.getElementById('flowDirection').value;
    mermaidCode = mermaidCode.replace(/flowchart\s+(TD|LR|BT|RL)/, 'flowchart ' + newDir);
    Platform.postMessage({ type: 'update', mermaidCode });
    render();
  }

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
    
    let newCode = '';

    if (prompt) {
      newCode += `    %% @${nodeId} [${type}]: ${prompt.replace(/\n/g, ' ')}\n`;
    }
    
    newCode += `    ${nodeId}${shape.open}${label}${shape.close}\n`;

    if (connectFrom) {
      newCode += `    ${connectFrom} --> ${nodeId}\n`;
    }

    newCode += `    style ${nodeId} ${shape.style}\n`;

    if (!mermaidCode.trim()) {
      mermaidCode = 'flowchart TD\n' + newCode;
    } else {
      const stylesMatch = mermaidCode.match(/\n(\s*style\s)/);
      if (stylesMatch) {
        const pos = mermaidCode.indexOf(stylesMatch[0]);
        mermaidCode = mermaidCode.slice(0, pos) + '\n' + newCode + mermaidCode.slice(pos);
      } else {
        mermaidCode += '\n' + newCode;
      }
    }
    
    closeAddNodeModal();
    Platform.postMessage({ type: 'update', mermaidCode });
    render();
  }

  // ============================================
  // Node Position Helpers
  // ============================================
  
  function getNodeCenter(nodeId) {
    const container = document.getElementById('mermaid-output');
    let nodeEl = null;
    
    container.querySelectorAll('.node').forEach(el => {
      if (el.id && (el.id.includes(nodeId) || el.id.includes('flowchart-' + nodeId))) {
        nodeEl = el;
      }
    });
    
    if (!nodeEl) return null;
    
    const bbox = nodeEl.getBBox();
    const offset = nodeOffsets[nodeId] || { x: 0, y: 0 };
    
    return {
      x: bbox.x + bbox.width / 2 + offset.x,
      y: bbox.y + bbox.height / 2 + offset.y
    };
  }

  // ============================================
  // Event Listeners Setup
  // ============================================
  
  function setupEventListeners() {
    const graphView = document.getElementById('graph-view');
    
    // Close context menu on click outside
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('.node')) {
        hideContextMenu();
      }
    });

    // Source editor change detection
    document.getElementById('source-editor').addEventListener('input', (e) => {
      mermaidCode = e.target.value;
      Platform.postMessage({ type: 'update', mermaidCode });
    });

    // Panning
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
        
        const container = document.getElementById('mermaid-output');
        
        container.querySelectorAll('.node').forEach(nodeEl => {
          if (nodeEl.id && (nodeEl.id.includes(draggingNodeId) || nodeEl.id.includes('flowchart-' + draggingNodeId))) {
            const baseTransform = nodeEl.getAttribute('data-base-transform') || '';
            nodeEl.setAttribute('transform', `${baseTransform} translate(${newX},${newY})`);
          }
        });
        
        return;
      }
      
      if (!isPanning) return;
      transform.x = e.clientX - startPan.x;
      transform.y = e.clientY - startPan.y;
      updateTransform();
    });

    document.addEventListener('mouseup', () => {
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

    // Zoom with scroll
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

    // Modal close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.onclick = (e) => {
        if (e.target.classList.contains('modal-overlay')) {
          modal.classList.remove('active');
        }
      };
    });

    // Enter key in node label input
    document.getElementById('nodeLabel').onkeydown = (e) => {
      if (e.key === 'Enter') confirmAddNode();
    };

    // Platform message handler
    Platform.onMessage((data) => {
      if (data.type === 'load') {
        mermaidCode = data.mermaidCode || '';
        if (currentView === 'graph') {
          render();
        } else {
          document.getElementById('source-editor').value = mermaidCode;
        }
      }
    });
  }

  // ============================================
  // Initialization
  // ============================================
  
  function init() {
    initMermaid();
    setupEventListeners();
    updateTransform();
    
    console.log(`[VizVibe] Initialized on ${Platform.getPlatformName()} platform`);
  }

  // Export functions to global scope for HTML onclick handlers
  window.VizVibeApp = {
    switchView,
    openAddNodeModal,
    closeAddNodeModal,
    confirmAddNode,
    changeDirection,
    resetView,
    zoomIn,
    zoomOut,
    fitToScreen,
    closeInfoCard,
    copyNodeInfo,
    copyNodeId,
    copyNodeLabel,
    copyNodeDescription,
    copyNodeAll
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

