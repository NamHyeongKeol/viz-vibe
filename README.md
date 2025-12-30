<div align="center">

# ✨ Viz Vibe

### Visualization for Vibe Coding

<p align="center">
  <strong>A graph-based workflow interface for seamless Human-AI collaboration</strong>
  <br/>
  <sub>🆓 Available as a free extension for <b>VS Code</b>, <b>Cursor</b>, and <b>Antigravity</b></sub>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#ai-integration">AI Integration</a> •
  <a href="#usage">Usage</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/AI-compatible-purple.svg" alt="AI Compatible">
</p>

---

</div>

## 🚀 About

**Viz Vibe** is an open-source project that provides a **graph-structured workflow** as an interface for collaboration between humans and AI. By visualizing the coding process as an interactive graph, it enables intuitive and efficient "vibe coding" experiences.

> 💡 *Vibe Coding* — A new paradigm where developers and AI work together in harmony, guided by visual workflows and intuitive interactions.

## ✨ Features

- 🔗 **Graph-based Workflows** — Visualize and manage your coding tasks as interconnected nodes
- 🤝 **Human-AI Collaboration** — Seamlessly integrate AI assistance into your development workflow
- 📊 **Interactive Visualization** — Real-time visual feedback for your coding journey
- 🔄 **Flexible Integration** — Easy to integrate with your existing tools and workflows
- 📁 **`.vizflow` File Format** — AI-editable JSON-based workflow files
- 🤖 **AI-Native Design** — Built from the ground up for AI assistants to read and modify

---

## 🤖 AI Integration

### How AI Assistants Interact with Viz Vibe

Viz Vibe is designed to be **AI-native**. AI assistants (GitHub Copilot, Cursor, Claude, Antigravity, etc.) can:

#### 1. **Read Workflows** 📖
AI can read `.vizflow` files to understand:
- Current project structure and progress
- Pending tasks and their dependencies
- Workflow state and decision points

```
User: "What's the current status of my workflow?"
AI: *reads workflow.vizflow* "Your workflow has 5 nodes. 
     The 'Analyze Code' task is complete, and you're at the 
     'Needs Refactoring?' decision point..."
```

#### 2. **Modify Workflows** ✏️
AI can directly edit `.vizflow` files to:
- Add new task nodes
- Update task descriptions and prompts
- Reorganize workflow structure
- Mark tasks as complete

```
User: "Add a 'Write Tests' step after refactoring"
AI: *edits workflow.vizflow* "Added 'Write Tests' node 
     connected after 'Refactor Code'. The graph UI will 
     update automatically."
```

#### 3. **Sync with Graph UI** 🔄
When AI modifies the `.vizflow` file:
- The Viz Vibe extension detects the change
- Graph UI updates **in real-time**
- No manual refresh needed!

---

### 📋 VIZVIBE.md - AI Instructions File

Create a `VIZVIBE.md` file in your project root to provide **custom instructions** to AI assistants about how to work with your workflows.

#### Template

```markdown
# VIZVIBE.md - AI Instructions for Viz Vibe

## Workflow File Location
./workflow.vizflow

## Project-Specific Instructions
- This project uses a TDD workflow
- Always add test nodes before implementation nodes
- Use descriptive labels for AI tasks

## Node Naming Convention
- Use kebab-case for node IDs: `analyze-code`, `write-tests`
- Prefix AI tasks with the action: `ai-review`, `ai-generate`

## Current Sprint Goals
- [ ] Complete authentication module
- [ ] Add error handling
- [ ] Write integration tests
```

#### Why VIZVIBE.md?

| Benefit | Description |
|---------|-------------|
| 🎯 **Context** | AI understands your project's workflow conventions |
| 📏 **Consistency** | Ensures AI follows your team's standards |
| 🔧 **Customization** | Tailor AI behavior for your specific needs |
| 📝 **Documentation** | Serves as workflow documentation for your team |

---

## 📦 Installation

### From VS Code Marketplace (Coming Soon)

Search for "Viz Vibe" in the VS Code Extensions marketplace.

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/NamHyeongKeol/viz-vibe.git

# Navigate to the project directory
cd viz-vibe

# Install dependencies
npm install

# Compile the extension
npm run compile
```

Then press `F5` in VS Code to launch the Extension Development Host.

---

## 🎯 Usage

### Creating a Workflow

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run `Viz Vibe: Create New Workflow`
3. Enter a filename (e.g., `my-workflow.vizflow`)

### Opening a Workflow

Simply open any `.vizflow` file — the **Graph Editor** will display automatically instead of raw JSON!

### Workflow File Format

Workflows are stored as `.vizflow` files (JSON format), making them **easily editable by AI assistants**:

```json
{
  "version": "1.0",
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "position": { "x": 100, "y": 50 },
      "data": { "label": "Start" }
    },
    {
      "id": "analyze",
      "type": "ai-task",
      "position": { "x": 100, "y": 150 },
      "data": { 
        "label": "Analyze Code",
        "prompt": "Analyze the codebase for improvements"
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "start", "target": "analyze" }
  ]
}
```

### Node Types

| Type | Description | Color |
|------|-------------|-------|
| `start` | Entry point of the workflow | 🟢 Green |
| `ai-task` | AI-powered task node | 🔵 Blue |
| `condition` | Decision/branching node | 🟠 Orange |
| `end` | Exit point of the workflow | 🔴 Red |

### Graph Editor Features

- **Drag & Drop** — Move nodes by dragging
- **Add Nodes** — Use toolbar buttons to add new nodes
- **Delete Nodes** — Select a node and click Delete
- **Auto-Save** — Changes save automatically to the `.vizflow` file

---

## 🛠 Development

### Project Structure

```
viz-vibe/
├── src/
│   ├── extension.ts              # Extension entry point
│   ├── VizFlowEditorProvider.ts  # Custom editor (main area)
│   └── WorkflowEditorProvider.ts # Sidebar webview
├── examples/
│   ├── code-review.vizflow       # Example workflow
│   └── VIZVIBE.md                # Example AI instructions
├── .vscode/
│   ├── launch.json               # Debug configuration
│   └── tasks.json                # Build tasks
├── package.json                  # Extension manifest
└── README.md
```

### Commands

```bash
# Watch mode (auto-compile on save)
npm run watch

# One-time compile
npm run compile

# Package as .vsix
npx vsce package
```

### Debugging

1. Open this project in VS Code
2. Press `F5` to launch Extension Development Host
3. The extension will be active in the new window

---

## 🤝 Contributing

We welcome contributions from the community! Whether it's:

- 🐛 Bug reports
- 💡 Feature suggestions
- 📝 Documentation improvements
- 🔧 Code contributions

Please feel free to open an issue or submit a pull request.

### Contribution Ideas

- [ ] Add more node types (loop, parallel, etc.)
- [ ] Implement edge creation via drag
- [ ] Add node editing modal
- [ ] Create workflow templates
- [ ] Add workflow validation

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Made with ❤️ for the vibe coding community**

[GitHub](https://github.com/NamHyeongKeol/viz-vibe) · [Report Bug](https://github.com/NamHyeongKeol/viz-vibe/issues) · [Request Feature](https://github.com/NamHyeongKeol/viz-vibe/issues)

</div>
