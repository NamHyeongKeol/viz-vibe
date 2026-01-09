/**
 * Platform Abstraction Layer for Viz Vibe
 * 
 * This module provides a unified interface for platform-specific operations.
 * - VSCode: Uses acquireVsCodeApi() for communication
 * - Web: Uses fetch/localStorage/WebSocket for communication
 */

// Platform interface that adapters must implement
const PlatformInterface = {
  // Send message to host (VSCode extension or web server)
  postMessage: (message) => { throw new Error('Not implemented'); },
  
  // Called when receiving message from host
  onMessage: (callback) => { throw new Error('Not implemented'); },
  
  // Get platform name
  getPlatformName: () => { throw new Error('Not implemented'); }
};

// VSCode Platform Adapter
const VSCodePlatform = {
  _vscode: null,
  _messageCallback: null,
  
  init() {
    if (typeof acquireVsCodeApi !== 'undefined') {
      this._vscode = acquireVsCodeApi();
      
      // Set up message listener
      window.addEventListener('message', (e) => {
        if (this._messageCallback) {
          this._messageCallback(e.data);
        }
      });
      
      return true;
    }
    return false;
  },
  
  postMessage(message) {
    if (this._vscode) {
      this._vscode.postMessage(message);
    }
  },
  
  onMessage(callback) {
    this._messageCallback = callback;
  },
  
  getPlatformName() {
    return 'vscode';
  }
};

// Web Platform Adapter (for future use)
const WebPlatform = {
  _messageCallback: null,
  _currentFile: null,
  
  init() {
    // Web platform initialization
    // Could set up WebSocket, fetch initial data, etc.
    return true;
  },
  
  postMessage(message) {
    // In web mode, handle messages locally or send to server
    if (message.type === 'update') {
      // Save to localStorage or send to server
      localStorage.setItem('vizvibe_mermaidCode', message.mermaidCode);
      console.log('[WebPlatform] Saved mermaid code');
    }
  },
  
  onMessage(callback) {
    this._messageCallback = callback;
  },
  
  // Simulate loading data (for web mode)
  loadFromStorage() {
    const saved = localStorage.getItem('vizvibe_mermaidCode');
    if (saved && this._messageCallback) {
      this._messageCallback({ type: 'load', mermaidCode: saved });
    }
  },
  
  getPlatformName() {
    return 'web';
  }
};

// Platform detection and initialization
let Platform = null;

function initPlatform() {
  // Try VSCode first
  if (VSCodePlatform.init()) {
    Platform = VSCodePlatform;
    console.log('[Platform] Running in VSCode mode');
  } else {
    // Fall back to web platform
    WebPlatform.init();
    Platform = WebPlatform;
    console.log('[Platform] Running in Web mode');
    
    // In web mode, load from storage after a short delay
    setTimeout(() => WebPlatform.loadFromStorage(), 100);
  }
  
  return Platform;
}

// Export for use in app.js
window.VizVibePlatform = {
  init: initPlatform,
  getPlatform: () => Platform
};


