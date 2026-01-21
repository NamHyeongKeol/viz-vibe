import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

export class VizFlowEditorProvider implements vscode.CustomTextEditorProvider, vscode.Disposable {
  public static readonly viewType = 'vizVibe.vizflowEditor';
  
  // Track active webview panel for search command
  private static activeWebviewPanel: vscode.WebviewPanel | null = null;
  private codexRunner: CodexRunner | null = null;
  private readonly codexOutput: vscode.OutputChannel;

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new VizFlowEditorProvider(context);
    const registration = vscode.window.registerCustomEditorProvider(
      VizFlowEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false
      }
    );
    return vscode.Disposable.from(registration, provider);
  }

  // Trigger search in the active webview (called from extension.ts via Cmd+F)
  public static triggerSearch(): void {
    if (VizFlowEditorProvider.activeWebviewPanel) {
      VizFlowEditorProvider.activeWebviewPanel.webview.postMessage({ type: 'openSearch' });
    }
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    this.codexOutput = vscode.window.createOutputChannel('Viz Vibe Codex');
  }

  public dispose(): void {
    this.codexRunner?.dispose();
    this.codexRunner = null;
    this.codexOutput.dispose();
  }

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
      } else if (message.type === 'launchAgent') {
        await this.launchAgent(message.agentId);
      } else if (message.type === 'runCodexForNode') {
        await this.runCodexForNode(message.prompt || '');
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
    const htmlPath = path.join(this.context.extensionPath, 'media', 'vizflow.html');
    const rawHtml = fs.readFileSync(htmlPath, 'utf8');
    return rawHtml;
  }

  private async launchAgent(agentId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('vizVibe');
    const agentMap: Record<string, { label: string; settingKey: string; defaultCommand: string; preferCommand?: string[] }> = {
      'codex': { label: 'Codex', settingKey: 'agentCommands.codex', defaultCommand: 'codex' },
      'claude-code': { label: 'Claude Code', settingKey: 'agentCommands.claudeCode', defaultCommand: 'claude' },
      'opencode': { label: 'OpenCode', settingKey: 'agentCommands.openCode', defaultCommand: 'opencode' },
      'cursor-agent': { label: 'Cursor Agent', settingKey: 'agentCommands.cursorAgent', defaultCommand: 'cursor-agent' },
      'copilot': {
        label: 'Copilot',
        settingKey: 'agentCommands.copilot',
        defaultCommand: '',
        preferCommand: ['github.copilot.chat.open', 'github.copilot.chat.focus']
      },
      'kiro': { label: 'Kiro', settingKey: 'agentCommands.kiro', defaultCommand: 'kiro' }
    };

    const agent = agentMap[agentId];
    if (!agent) {
      vscode.window.showWarningMessage(`Unknown agent: ${agentId}`);
      return;
    }

    if (agent.preferCommand) {
      for (const command of agent.preferCommand) {
        try {
          await vscode.commands.executeCommand(command);
          return;
        } catch {
          // Fall back to terminal command if VS Code command is unavailable.
        }
      }
    }

    const command = await this.resolveAgentCommand(agent);
    if (!command) return;

    this.runTerminalCommand(agent.label, command);
  }

  private async runCodexForNode(prompt: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('Viz Vibe: Please open a workspace to run Codex.');
      return;
    }
    if (!this.codexRunner) {
      this.codexRunner = new CodexRunner(this.codexOutput, workspaceRoot);
    }
    try {
      await this.codexRunner.sendPrompt(prompt);
      this.codexOutput.show(true);
    } catch (error) {
      this.codexOutput.appendLine(`[error] ${String(error)}`);
      vscode.window.showErrorMessage('Viz Vibe: Failed to run Codex. See output for details.');
    }
  }

  private async resolveAgentCommand(agent: { label: string; settingKey: string; defaultCommand: string }): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration('vizVibe');
    let command = config.get<string>(agent.settingKey);
    if (!command) {
      command = await vscode.window.showInputBox({
        prompt: `Enter command to launch ${agent.label} (use {prompt} to inject text)`,
        value: agent.defaultCommand || ''
      });
      if (!command) {
        vscode.window.showInformationMessage(`${agent.label} launch canceled.`);
        return undefined;
      }
      await config.update(agent.settingKey, command, vscode.ConfigurationTarget.Global);
    }
    return command;
  }

  private runTerminalCommand(label: string, command: string): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const terminal = vscode.window.createTerminal({
      name: `Viz Vibe: ${label}`,
      cwd: workspaceRoot
    });
    terminal.show(true);
    terminal.sendText(command, true);
  }
}

class CodexRunner {
  private child: ChildProcessWithoutNullStreams | null = null;
  private rpc: JsonRpcClient | null = null;
  private threadId: string | null = null;
  private turnId: string | null = null;
  private readyPromise: Promise<void> | null = null;
  private readonly cwd: string;

  constructor(private readonly output: vscode.OutputChannel, cwd: string) {
    this.cwd = cwd;
  }

  dispose(): void {
    this.child?.kill('SIGINT');
    this.child = null;
    this.rpc = null;
    this.threadId = null;
    this.turnId = null;
    this.readyPromise = null;
  }

  async sendPrompt(prompt: string): Promise<void> {
    await this.ensureReady();
    if (!this.rpc || !this.threadId) {
      throw new Error('Codex app-server not ready.');
    }
    this.output.appendLine('[codex] sending prompt');
    const result = await this.rpc.request('turn/start', {
      threadId: this.threadId,
      thread_id: this.threadId,
      input: [{ type: 'text', text: prompt }],
      cwd: this.cwd,
      approval_policy: 'on-request',
      sandbox_policy: 'workspace-write'
    });
    const turnId = result?.turn_id ?? result?.turnId ?? null;
    if (turnId) {
      this.turnId = turnId;
      this.output.appendLine(`[codex] turn started id=${turnId}`);
    }
  }

  private async ensureReady(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.start();
    return this.readyPromise;
  }

  private async start(): Promise<void> {
    this.output.appendLine('[codex] starting app-server');
    const child = spawn('npx', ['-y', '@openai/codex@0.77.0', 'app-server'], {
      cwd: this.cwd,
      env: {
        NODE_NO_WARNINGS: '1',
        NO_COLOR: '1',
        RUST_LOG: 'error',
        ...process.env
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.child = child;

    child.on('exit', (code, signal) => {
      this.output.appendLine(`[codex] exited code=${code ?? 'null'} signal=${signal ?? 'null'}`);
      this.child = null;
      this.rpc = null;
      this.threadId = null;
      this.turnId = null;
      this.readyPromise = null;
    });

    const stdoutRl = createInterface({ input: child.stdout });
    const stderrRl = createInterface({ input: child.stderr });
    stdoutRl.on('line', (line) => {
      this.output.appendLine(`[codex] ${sanitizeCodexLine(line)}`);
      this.rpc?.handleLine(line);
    });
    stderrRl.on('line', (line) => this.output.appendLine(`[codex:err] ${line}`));

    const rpc = new JsonRpcClient(
      (line) => child.stdin.write(`${line}\n`),
      () => {}
    );
    this.rpc = rpc;

    await rpc.request('initialize', {
      clientInfo: { name: 'viz-vibe', version: '0.1.43' }
    });
    rpc.notify('initialized', {});

    const auth = await rpc.request('getAuthStatus', {
      includeToken: true,
      refreshToken: false
    });
    const requiresAuth = auth?.requires_openai_auth ?? auth?.requiresOpenaiAuth ?? true;
    const authMethod = auth?.auth_method ?? auth?.authMethod;
    if (requiresAuth && !authMethod) {
      throw new Error('Codex authentication required');
    }

    const thread = await rpc.request('thread/start', {
      cwd: this.cwd,
      approval_policy: 'on-request',
      sandbox_policy: 'workspace-write'
    });
    const threadId =
      thread?.thread_id ??
      thread?.threadId ??
      thread?.thread?.id ??
      thread?.thread?.thread_id ??
      thread?.thread?.threadId;
    if (!threadId) {
      throw new Error('Codex missing thread id');
    }
    this.threadId = threadId;
    this.output.appendLine(`[codex] ready thread=${threadId}`);
  }
}

class JsonRpcClient {
  private nextId = 1;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();

  constructor(
    private write: (line: string) => void,
    private onMessage: (msg: any) => void
  ) {}

  request(method: string, params?: unknown) {
    const id = String(this.nextId++);
    const payload = { jsonrpc: '2.0', id, method, params };
    this.write(JSON.stringify(payload));
    return new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  notify(method: string, params?: unknown) {
    const payload = { jsonrpc: '2.0', method, params };
    this.write(JSON.stringify(payload));
  }

  handleLine(line: string) {
    const msg = safeJsonParse(line);
    if (!msg) return;

    if (msg.id !== undefined && msg.method) {
      this.onMessage(msg);
      return;
    }

    if (msg.id !== undefined) {
      const key = String(msg.id);
      const pending = this.pending.get(key);
      if (!pending) return;
      this.pending.delete(key);

      if (msg.error) {
        pending.reject(new Error(msg.error.message ?? 'JSON-RPC error'));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    if (msg.method) {
      this.onMessage(msg);
    }
  }
}

function safeJsonParse(line: string): any | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function sanitizeCodexLine(line: string): string {
  const msg = safeJsonParse(line);
  if (!msg || typeof msg !== 'object') return line;
  const cloned = JSON.parse(JSON.stringify(msg));
  if (cloned?.result?.authToken) {
    cloned.result.authToken = '[redacted]';
  }
  if (cloned?.result?.auth_token) {
    cloned.result.auth_token = '[redacted]';
  }
  return JSON.stringify(cloned);
}
