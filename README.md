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
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/status-active-success.svg" alt="Status">
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

## 🎯 Usage

### Creating a Workflow

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run `Viz Vibe: Create New Workflow`
3. Enter a filename (e.g., `my-workflow.vizflow`)

### Opening the Workflow Editor

1. Click the **Viz Vibe** icon in the Activity Bar (sidebar)
2. Or run `Viz Vibe: Open Workflow Editor` from the Command Palette

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

## 🛠 Development

### Project Structure

```
viz-vibe/
├── src/
│   ├── extension.ts          # Extension entry point
│   └── WorkflowEditorProvider.ts  # Webview provider
├── examples/
│   └── code-review.vizflow   # Example workflow
├── .vscode/
│   ├── launch.json           # Debug configuration
│   └── tasks.json            # Build tasks
├── package.json              # Extension manifest
└── tsconfig.json             # TypeScript config
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

## 🤝 Contributing

We welcome contributions from the community! Whether it's:

- 🐛 Bug reports
- 💡 Feature suggestions
- 📝 Documentation improvements
- 🔧 Code contributions

Please feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Made with ❤️ for the vibe coding community**

[GitHub](https://github.com/NamHyeongKeol/viz-vibe) · [Report Bug](https://github.com/NamHyeongKeol/viz-vibe/issues) · [Request Feature](https://github.com/NamHyeongKeol/viz-vibe/issues)

</div>
