# VIZVIBE.md - Trajectory Management Guide

This document provides instructions for AI assistants on how to maintain the `vizvibe.mmd` file as a **context map** for the project.

---

## About Viz Vibe

# Viz-Vibe: Visual Context Map for Vibe Coding

**Viz Vibe** is a graph-based navigator to track your coding trajectory and maintain context across threads. We make human-AI collaboration seamless by keeping coding context clear at a glance.

### What is `vizvibe.mmd`?

The `vizvibe.mmd` file is a **Mermaid flowchart** that serves as:

- A **visual map** of the project's evolution
- A **shared context** between human and AI
- A **TODO/hypothesis tracker** in graph form
- A **memory** that persists across conversation sessions

It's not a changelog or commit log — it's a **living document** that captures the high-level journey of a project.

---

## User Context

### Who Uses Viz Vibe?

Our primary users are developers who:

- Are in the middle of **vibe coding** with an AI assistant
- Have been struggling with **context management** across sessions
- Want to visualize their coding journey without losing momentum

### Installation Scenario

Users typically install Viz Vibe **while keeping their current AI conversation session active**:

- They open a **separate terminal window** to run the install command
- Their main AI session (Cursor, Antigravity, VS Code, Claude Code, Codex CLI) continues running
- They expect the AI to immediately understand and use the trajectory

### The Critical First Draft

**Creating a good initial graph is essential.**

When creating the first draft of `vizvibe.mmd`, gather information from these sources **in priority order**:

#### Priority 1: Current Conversation History (Primary Source)

The user's current conversation with their AI assistant is the most valuable source. This reveals:

- What the user has been working on
- What decisions were made
- What's still pending
- What blockers were encountered

Thoroughly read the conversation history and extract key milestones, decisions, and pending work.

#### Priority 2: Git History (6 Months)

Review the project's git history to understand the broader trajectory:

```bash
# Recommended: Whichever gives more coverage
git log --oneline --since="6 months ago"  # For projects with sparse commits
git log --oneline -n 300                   # For active projects with many commits
```

**Guideline:**

- If the project has **many recent commits**: limit to 300 commits
- If the project has **fewer than 300 commits in 6 months**: view the full 6 months

This ensures:

- Active projects don't overwhelm with too much history
- Quieter projects still get full recent context

**What to look for:**

- Major feature additions and refactoring
- Branch patterns and merge history
- Commit message themes (what areas are actively developed)
- Don't analyze each commit in detail — understand the overall trajectory

#### Priority 3: README and Project Documentation

Most users document their project extensively in the README. This is often the best source for understanding:

- Project purpose and goals
- Architecture and design decisions
- Setup instructions and dependencies
- Current status and roadmap

**Always read the README** — it's the user's curated summary of their project.

Also look for:

- `CONTRIBUTING.md`, `ARCHITECTURE.md`, or similar docs
- `TODO.md` or issue tracking files
- Package manifests (`package.json`, `pyproject.toml`, etc.) for project metadata

#### Priority 4: Ask the User for Feedback and TODO/Plans

**After creating the initial draft**, ask the user for both feedback and additional context:

> "I've created an initial trajectory based on our conversation, git history, and project docs.
>
> 1. **Is anything incorrect or would you like to change anything?** (Did I misunderstand something?)
> 2. **Do you have any TODO lists, project plans, or important context** that should be included?"

This two-part question helps:

- **Correct misunderstandings** before they propagate through future updates
- **Add missing context** like TODOs and plans the user has in mind
- **Build a more accurate trajectory** through user feedback

This approach works better than asking before the draft because:

- The user can see the graph format first and understand what kind of info is useful
- The flow feels more natural ("here's what I found → anything wrong or to add?")
- Doesn't block the initial draft creation if the user is busy

**Important:** Apply user feedback immediately and add any TODOs/plans as `[opened]` nodes with appropriate connections.

---

### Combining All Sources

**Key principle**: The conversation is the starting point, but the trajectory should reflect the **full project context** — including things the user didn't explicitly mention.

When combining information:

- **Fill gaps**: Capture work that happened before this conversation or in other sessions
- **Verify understanding**: Confirm that conversation context matches actual code state
- **Add missing context**: Include important project history not mentioned in the conversation
- **Resolve conflicts**: When sources disagree, git history is usually the source of truth for what actually happened

### Capture the Human-AI Perspective

The trajectory should capture more than just code changes — it should reflect the **shared understanding** between the user and AI:

- **Interpretation of history**: How do we understand what was done and why?
- **Future direction**: What are the agreed-upon next steps?
- **Open questions**: What hypotheses need validation?
- **Lessons learned**: What approaches worked or didn't work?

The `.mmd` file is not just a changelog — it's a **living map of the project's context** as understood by both human and AI.

### Update Granularity

**Code changes and trajectory updates are not always coupled:**

| Scenario                                                                   | Update .mmd? |
| -------------------------------------------------------------------------- | ------------ |
| Major discussion without code changes (e.g., planning, deciding direction) | ✅ Yes       |
| Small code fix or routine refactoring                                      | ❌ No        |
| New hypothesis or approach identified                                      | ✅ Yes       |
| Bug fix that doesn't change project direction                              | ❌ No        |
| Completing a significant milestone                                         | ✅ Yes       |

Think of the trajectory as a **graph of TODOs and hypotheses**, not a log of every action. It operates at a higher level than individual code changes.

**Rule of thumb**: If it's something you'd want to remember when resuming work tomorrow, or when explaining the project to a new collaborator — it belongs in the trajectory.

---

## Language Preference

**Default language is English. Match the user's language when detected.**

When creating or updating `vizvibe.mmd`:

1. **English by default**: If no language preference is detected, always use English
2. **Detect user language**: Check the user's conversation language, system locale, or explicit preference
3. **Match user language**: If the user communicates in a specific language (e.g., Korean, Japanese, Spanish), write node titles and descriptions in that language
4. **Consistent language**: Keep all nodes in the same language for readability

**Examples:**

English (default):

```mermaid
%% @feature_login [ai-task, closed]
feature_login("Login Feature<br/><sub>Implemented OAuth2.0 social login<br/>and email/password authentication<br/>with JWT token-based sessions</sub>")
```

Korean (when user communicates in Korean):

```mermaid
%% @feature_login [ai-task, closed]
feature_login("로그인 기능 구현<br/><sub>OAuth2.0 기반 소셜 로그인과<br/>이메일/비밀번호 인증 구현,<br/>JWT 토큰 기반 세션 관리</sub>")
```

**Note**: Node IDs (`feature_login`) should remain in English/ASCII for technical compatibility, only the display content (title and description) should be localized.

---

## Key Decisions When Building the Graph

When adding information to the trajectory, two decisions are critical:

### Decision 1: Should this be a node?

Not every piece of information deserves a node. Ask:

- Is this significant enough to remember?
- Would this help understand the project's evolution?
- Is this a milestone, decision point, or learning?
- If there are two similar plans or tasks at the same level, either add both or add neither — don't create an unbalanced graph

If no — don't add it. Keep the graph focused.

### Decision 2: How should nodes be connected?

**Which node to connect to is critically important.**

Once you decide to add a node, determine:

- **Which existing node(s) should it connect to?** Choose carefully — this defines the relationship.
- **Should it connect at all?** Not all nodes need connections.
- **Parallel or sequential?**
  - **Parallel**: Independent tasks that can happen in any order
  - **Sequential**: Task B depends on Task A completing first

This is where most mistakes happen — connecting things that shouldn't be connected, or chaining independent tasks.

---

## Core Principles

### 1. Graph-Based History

Maintain the project history as a **graph structure** in `vizvibe.mmd`:

- **Doesn't have to be a tree** — cycles and multiple paths are allowed
- Captures the evolution of the project at a **high level**
- Shows decision points, experiments, and outcomes

### 2. Project Goals

The trajectory should clearly state:

- **Ultimate goal**: The final objective of the project
- **Current goal**: What we're working toward right now (if known)

Place these as prominent nodes or comments at the top of the graph.

### 3. Connecting Nodes: Parallel vs Sequential

When adding new nodes, carefully consider how they relate to existing nodes:

**Parallel connections** (branch from same parent):

- Tasks are independent and can happen in any order
- No dependency between them
- Common for "options to explore" or "alternative approaches"

**Sequential connections** (chain A → B):

- Task B depends on Task A
- B cannot start until A is done
- Represents true dependency

```mermaid
%% PARALLEL: Independent tasks branch from parent
parent --> option_a
parent --> option_b
parent --> option_c

%% SEQUENTIAL: B depends on A
task_a --> task_b --> task_c
```

**Common mistake**: Chaining tasks just because they happened in order. If there's no real dependency, they should be parallel.

**Note**: Future work is often parallel (multiple things to try), but can be sequential if there's a clear dependency chain.

### 4. Only Important Context

**DO NOT** add every small task to the trajectory:

- ✅ Major milestones and decisions
- ✅ Architectural changes
- ✅ Dead ends and blockers (valuable learnings)
- ✅ Branch points with multiple approaches
- ❌ Trivial fixes
- ❌ Minor refactoring
- ❌ Routine tasks

---

## Node States: `[opened]` vs `[closed]`

Every node must have a state indicated in its metadata comment:

```mermaid
%% @node_id [ai-task, opened]: Task we plan to do
%% @node_id [ai-task, closed]: Task we completed or abandoned
```

### `[opened]` — TODO

- Task is planned but **not yet started**
- Represents future work worth tracking
- May have uncertainty about approach

### `[closed]` — DONE (success or failure)

A node is closed when:

- ✅ **Successfully completed** — achieved its goal
- ❌ **Dead end** — tried but hit limitations (use `blocker` type)
- ⏭️ **No longer needed** — situation changed, task became irrelevant

### State Transitions

| Scenario                     | Action                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Completed successfully       | Change to `[closed]`                                                         |
| Tried but failed/blocked     | Change to `[closed]`, use `blocker` type                                     |
| No longer needed (important) | Change to `[closed]`, optionally connect from the node that made it obsolete |
| No longer needed (trivial)   | **Delete the node**                                                          |
| Retrospectively trivial      | **Delete the node**                                                          |

---

## Managing the Graph

### Restructuring the Graph

If the existing `vizvibe.mmd` seems **incorrectly structured** based on your new understanding of the project:

- You **may restructure** the graph to better reflect the actual context
- Reorganize nodes and edges to show the true relationships
- This is not "rewriting history" — it's correcting a previously inaccurate map

Common reasons to restructure:

- Nodes were connected that shouldn't be (false dependencies)
- Parallel work was incorrectly shown as sequential
- The graph doesn't match the actual project evolution
- Key context was missing or misrepresented

### Proactively Suggest Corrections

When new information causes a **reinterpretation** of past history or future plans:

- The entire map may need to be restructured
- **Don't wait for the user to ask** — proactively suggest corrections
- Explain what changed and why the current structure is inaccurate
- Propose a revised structure that reflects the new understanding

This is especially important when:

- A major assumption turns out to be wrong
- The project direction fundamentally shifts
- Previously separate efforts are now understood to be connected (or vice versa)

### Adding Nodes

Add a node when:

- You complete significant work worth remembering
- You discover a new approach to explore
- You hit a dead end (valuable for future context!)
- You identify future work from the current conversation

### Removing Nodes

Remove a node when:

- It was added by mistake
- It turned out to be trivial in hindsight
- It clutters the graph without adding context

> **Note**: This is different from closing a node. Closed nodes remain as history. Deleted nodes are gone.

### Updating Connections

When new information changes the graph:

- Add edges from nodes that enable or invalidate other nodes
- Remove edges that no longer represent real dependencies
- Cycles are allowed if they represent iterative refinement

---

## Real-World Example

Here's a complete example of a `vizvibe.mmd` file from the Viz Vibe project itself:

```mermaid
flowchart TD
    %% === PROJECT GOALS ===
    %% Ultimate Goal: Make human-AI collaboration seamless with visual context maps
    %% Current Goal: Expand AI agent integrations to other platforms

    %% === START ===
    %% @project_start [start, closed]
    project_start("Viz Vibe Project Start<br/><sub>Graph-based context management tool<br/>that visualizes coding trajectory<br/>as a Mermaid flowchart, enabling<br/>persistent memory across AI sessions</sub>")

    %% @ultimate_goal [end, opened]
    ultimate_goal("Solve the Context Problem<br/><sub>Enable developers to visualize their<br/>coding journey, persist memory across<br/>sessions, and seamlessly share context<br/>with any AI assistant regardless of platform</sub>")

    %% === COMPLETED WORK ===
    %% @mermaid_native [ai-task, closed]
    mermaid_native("Mermaid Native Format<br/><sub>Migrated from custom JSON schema<br/>to native Mermaid .mmd format,<br/>enabling rendering in GitHub, VS Code,<br/>and any Mermaid-compatible viewer</sub>")

    %% @claude_code_integration [ai-task, closed]
    claude_code_integration("Claude Code Hook Integration<br/><sub>Implemented hook-based automation<br/>for Claude Code that automatically<br/>reads and updates vizvibe.mmd on<br/>session start and after user messages</sub>")

    %% @vizvibe_guide [ai-task, closed]
    vizvibe_guide("VIZVIBE.md Guide<br/><sub>Created comprehensive documentation<br/>that teaches AI assistants how to<br/>read, update, and maintain vizvibe.mmd<br/>files with proper styling conventions</sub>")

    %% @install_scripts [ai-task, closed]
    install_scripts("CLI Install Scripts<br/><sub>Developed curl-based one-liner<br/>installation scripts that set up<br/>Claude Code hooks and copy templates,<br/>with uninstall scripts for clean removal</sub>")

    %% @vscode_extension [ai-task, closed]
    vscode_extension("VS Code Extension<br/><sub>Built VS Code extension featuring<br/>interactive graph visualization of<br/>vizvibe.mmd, click-to-copy node info<br/>for AI prompts, and custom editor</sub>")

    %% @lastactive_tracking [ai-task, closed]
    lastactive_tracking("Last Active Tracking<br/><sub>Implemented tracking of the most<br/>recently worked-on node via @lastActive<br/>marker in .mmd comments, with visual<br/>highlighting in graph view</sub>")

    %% @design_renewal [ai-task, closed]
    design_renewal("GitHub-Inspired Design<br/><sub>Redesigned graph styling with<br/>GitHub-inspired color palette:<br/>green borders for open tasks,<br/>purple borders for closed tasks</sub>")

    %% === FUTURE WORK: AI AGENT INTEGRATIONS ===
    %% @vscode_agent_integration [ai-task, opened]
    vscode_agent_integration("VS Code Copilot Integration<br/><sub>Integrate with VS Code's built-in<br/>AI features like GitHub Copilot Chat<br/>to automatically provide trajectory<br/>context when asking questions</sub>")

    %% @cursor_agent_integration [ai-task, opened]
    cursor_agent_integration("Cursor IDE Integration<br/><sub>Implement integration with Cursor IDE<br/>using .cursorrules file to inject<br/>trajectory management instructions<br/>into Cursor's AI assistant context</sub>")

    %% @antigravity_agent_integration [ai-task, opened]
    antigravity_agent_integration("Antigravity AI Integration<br/><sub>Integrate with Google's Antigravity<br/>by injecting VIZVIBE.md content into<br/>~/.gemini/GEMINI.md global rules file<br/>and providing keyboard shortcuts</sub>")

    %% @antigravity_hook_support [ai-task, opened]
    antigravity_hook_support("Antigravity Hook Automation<br/><sub>Apply the same hook-based automation<br/>pattern used in Claude Code once<br/>Antigravity adds support for lifecycle<br/>hooks like SessionStart</sub>")

    %% @codex_cli_integration [ai-task, opened]
    codex_cli_integration("Codex CLI Integration<br/><sub>Implement hook-based integration<br/>for OpenAI's Codex CLI tool, enabling<br/>automatic trajectory reading and<br/>updating during coding sessions</sub>")

    %% === FUTURE WORK: OTHER ===
    %% @lib_packaging [ai-task, opened]
    lib_packaging("Multi-Language SDK<br/><sub>Package vizvibe functionality as<br/>installable SDKs for Python (PyPI),<br/>JavaScript (npm), and Java (Maven)<br/>to enable programmatic management</sub>")

    %% @mcp_server [ai-task, opened]
    mcp_server("MCP Server<br/><sub>Build a Model Context Protocol server<br/>that exposes trajectory read/update<br/>tools, enabling any MCP-compatible<br/>AI client to manage vizvibe.mmd</sub>")

    %% === CONNECTIONS ===
    project_start --> mermaid_native
    mermaid_native --> claude_code_integration
    mermaid_native --> vscode_extension
    claude_code_integration --> vizvibe_guide
    claude_code_integration --> install_scripts
    claude_code_integration --> lib_packaging
    claude_code_integration --> codex_cli_integration
    vscode_extension --> lastactive_tracking
    lastactive_tracking --> design_renewal
    vscode_extension --> vscode_agent_integration
    vscode_extension --> cursor_agent_integration
    vscode_extension --> antigravity_agent_integration
    antigravity_agent_integration --> antigravity_hook_support
    mermaid_native --> mcp_server
    lib_packaging -.-> ultimate_goal
    mcp_server -.-> ultimate_goal
    codex_cli_integration -.-> ultimate_goal
    vscode_agent_integration -.-> ultimate_goal
    cursor_agent_integration -.-> ultimate_goal
    antigravity_hook_support -.-> ultimate_goal

    %% === RECENT WORK HIGHLIGHT ===
    %% Use subgraph to visually highlight recently completed work
    subgraph recent [RECENT]
        design_renewal
    end

    %% === STYLES ===
    %% GitHub-inspired colors: Open = green, Closed = purple/gray

    %% Start node (teal)
    style project_start fill:#1a1a2e,stroke:#2dd4bf,color:#5eead4,stroke-width:2px

    %% Ultimate Goal (muted)
    style ultimate_goal fill:#1a1a2e,stroke:#6b7280,color:#9ca3af,stroke-width:1px

    %% Closed tasks (soft purple - like GitHub merged)
    style mermaid_native fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd,stroke-width:1px
    style claude_code_integration fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd,stroke-width:1px
    style vizvibe_guide fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd,stroke-width:1px
    style install_scripts fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd,stroke-width:1px
    style vscode_extension fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd,stroke-width:1px
    style lastactive_tracking fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd,stroke-width:1px

    %% Recent node (highlighted - brighter purple)
    style design_renewal fill:#2d1f4e,stroke:#c084fc,color:#e9d5ff,stroke-width:2px

    %% Recent subgraph style (dashed purple border)
    style recent fill:transparent,stroke:#c084fc,color:#c084fc,stroke-width:2px,stroke-dasharray:5 5

    %% Open tasks (soft green - like GitHub open)
    style vscode_agent_integration fill:#1a1a2e,stroke:#4ade80,color:#86efac,stroke-width:1px
    style cursor_agent_integration fill:#1a1a2e,stroke:#4ade80,color:#86efac,stroke-width:1px
    style antigravity_agent_integration fill:#1a1a2e,stroke:#4ade80,color:#86efac,stroke-width:1px
    style antigravity_hook_support fill:#1a1a2e,stroke:#4ade80,color:#86efac,stroke-width:1px
    style codex_cli_integration fill:#1a1a2e,stroke:#4ade80,color:#86efac,stroke-width:1px
    style lib_packaging fill:#1a1a2e,stroke:#4ade80,color:#86efac,stroke-width:1px
    style mcp_server fill:#1a1a2e,stroke:#4ade80,color:#86efac,stroke-width:1px
```

### Key Patterns in This Example

1. **Start & Goal nodes**: Project start (teal) and ultimate goal (gray) frame the trajectory
2. **Title + Description format**: `("Title<br/><sub>Line 1<br/>Line 2<br/>Line 3<br/>Line 4</sub>")` — 1 title + 3-4 description lines
3. **Narrow and tall nodes**: Each line is ~30-35 characters, creating compact vertical nodes rather than wide horizontal ones
4. **Metadata without description**: The `%% @node_id [type, state]` comment does NOT include a description — all descriptions go in the node content using `<sub>` tags
5. **Clear separation**: Completed work (closed) vs Future work (opened)
6. **RECENT subgraph**: Wrap the most recently worked-on node in `subgraph recent [RECENT]` to create a dashed purple border box labeled "RECENT", making it easy to spot the most recent work at a glance. Style the node inside with bright purple for extra emphasis.
7. **Parallel branches from same parent**:
   - `claude_code_integration` → `lib_packaging`, `codex_cli_integration` (independent CLI integrations)
   - `vscode_extension` → `vscode_agent_integration`, `cursor_agent_integration` (IDE-related work)
8. **Dashed lines to ultimate goal (-.->)**: Shows what needs to be done but not yet achieved
9. **GitHub-inspired colors**: Green border = open, Purple border = closed, Bright purple = recent

---

## File Format

### Structure

```mermaid
flowchart TD
    %% === PROJECT GOALS ===
    %% Ultimate Goal: [describe the final objective]
    %% Current Goal: [describe immediate focus]

    %% === NODES ===
    %% @node_id [type, state]
    node_id("Short Title<br/><sub>Multi-line description with<br/>line breaks for readability</sub>")

    %% === RECENT ===
    subgraph recent [RECENT]
        recent_node_id
    end

    %% === EDGES ===
    node_a --> node_b

    %% === STYLES ===
    style node_id fill:#1a1a2e,stroke:#color,color:#text
    %% Recent node (bright purple)
    style recent_node_id fill:#2d1f4e,stroke:#c084fc,color:#e9d5ff,stroke-width:2px
    %% Recent subgraph (dashed border)
    style recent fill:transparent,stroke:#c084fc,color:#c084fc,stroke-width:2px,stroke-dasharray:5 5
```

### Node Shape

Use rounded rectangles `("...")` for all nodes. This creates a clean, uniform look:

```mermaid
node_id("Node Label")
```

### Node Content Format

**IMPORTANT**: Each node should contain a **short title** (1 line) and a **detailed description** (3-4 lines) using the following format:

```mermaid
%% @node_id [ai-task, closed]
node_id("Short Title<br/><sub>First line of description that explains<br/>what this node is about and why,<br/>including technical details and<br/>any outcomes or dependencies</sub>")
```

**Key rules:**

- **Title line**: Keep short and descriptive (e.g., "Claude Code Hook Integration")
- **Description in `<sub>` tag**: Write 3-4 lines with `<br/>` between each line
- **Metadata comment**: Only contains `@node_id [type, state]` — NO description text
- **Line width**: Keep each line around 30-35 characters to prevent wide nodes

**Guidelines for descriptions:**

- **Be comprehensive**: Write full sentences explaining what, why, and how
- **Include technical details**: Mention specific technologies, APIs, or approaches
- **Short lines, more of them**: Add `<br/>` frequently for narrow, tall nodes
- **Describe outcomes**: Explain what the completion of this node enables

**Example comparison:**

❌ **Too short (lacks detail)**:

```mermaid
%% @claude_code_integration [ai-task, closed]
claude_code_integration("Claude Code Integration<br/><sub>Hook-based automation</sub>")
```

✅ **Good format — rich content with frequent line breaks**:

```mermaid
%% @claude_code_integration [ai-task, closed]
claude_code_integration("Claude Code Hook Integration<br/><sub>Implemented hook-based automation<br/>for Claude Code that automatically<br/>reads and updates vizvibe.mmd on<br/>session start and after user messages</sub>")
```

**Goal**: Nodes should be **narrow and tall** (many short lines) rather than **wide and short** (few long lines).

### Node Types (in metadata only)

| Type         | Use Case                |
| ------------ | ----------------------- |
| `start`      | Project/phase beginning |
| `ai-task`    | AI work, implementation |
| `human-task` | Human decision/action   |
| `condition`  | Decision point, branch  |
| `blocker`    | Dead end, blocked path  |
| `end`        | Completion point        |

### Style Reference (GitHub-inspired)

All nodes use dark background with colored borders:

```mermaid
%% Start node (teal)
style node fill:#1a1a2e,stroke:#2dd4bf,color:#5eead4,stroke-width:2px

%% Closed tasks (soft purple - like GitHub merged)
style node fill:#1a1a2e,stroke:#a78bfa,color:#c4b5fd,stroke-width:1px

%% Open tasks (soft green - like GitHub open)
style node fill:#1a1a2e,stroke:#4ade80,color:#86efac,stroke-width:1px

%% Recent node (highlighted purple)
style node fill:#2d1f4e,stroke:#c084fc,color:#e9d5ff,stroke-width:2px

%% Blocker (soft red)
style node fill:#1a1a2e,stroke:#f87171,color:#fca5a5,stroke-width:1px

%% End/Goal (muted gray)
style node fill:#1a1a2e,stroke:#6b7280,color:#9ca3af,stroke-width:1px
```

**Color meanings:**

- **Green border**: Open/TODO tasks
- **Purple border**: Closed/Done tasks
- **Bright purple (highlighted)**: Recent node (inside RECENT subgraph)
- **Teal border**: Start node
- **Gray border**: End/Goal node
- **Red border**: Blocker

---

## AI Instructions Summary

1. **Read** `vizvibe.mmd` at the start of each session to understand context
2. **Update** after completing significant work
3. **Update RECENT subgraph** — move `subgraph recent [RECENT]` to wrap the node you just worked on
4. **Add future work** identified during the session as `[opened]` nodes
5. **Close nodes** when work is done or no longer relevant
6. **Delete nodes** that are trivial or mistaken
7. **Maintain relationships** — connect dependent tasks, keep independent tasks parallel
8. **Keep it high-level** — this is a map, not a changelog
9. **Use consistent styling** — GitHub-inspired colors (green=open, purple=closed, bright purple=recent)
10. **Pre-commit Update** — Always aim to update `vizvibe.mmd` before committing code changes to ensure the trajectory stays in sync with the project state.
