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

The **primary data source** is the user's current conversation history with their AI assistant. This reveals:

- What the user has been working on
- What decisions were made
- What's still pending
- What blockers were encountered

**AI assistants should:**

1. Thoroughly read the current conversation history
2. Extract key milestones, decisions, and pending work
3. Create a well-structured initial trajectory graph
4. Capture both completed work (`closed`) and planned work (`opened`)

### Always Review Codebase and Git History

**Even when conversation history seems sufficient**, always examine the codebase and git history to:

- **Fill gaps**: Capture work that happened before this conversation or in other sessions
- **Verify understanding**: Confirm that conversation context matches actual code state
- **Add missing context**: Include important project history not mentioned in the conversation

**What to look for:**

- **README.md (IMPORTANT!)**: Most users document their project extensively in the README. This is often the best source for understanding:

  - Project purpose and goals
  - Architecture and design decisions
  - Setup instructions and dependencies
  - Current status and roadmap

  **Always read the README first** — it's the user's curated summary of their project.

- **Git logs**: Get the big picture of recent work
  - Focus on the current branch's recent commits
  - Understand relationships with other branches
  - Don't analyze each commit in detail — understand the trajectory
- **Code structure**: Understand project organization and patterns
- **Recent changes**: Identify what's actively being developed

**Key principle**: The conversation is the starting point, but the trajectory should reflect the **full project context** — including things the user didn't explicitly mention.

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

## File Format

### Structure

```mermaid
flowchart TD
    %% === PROJECT GOALS ===
    %% Ultimate Goal: [describe the final objective]
    %% Current Goal: [describe immediate focus]

    %% === NODES ===
    %% @node_id [type, state]: Description
    node_id(["Label"])

    %% === EDGES ===
    node_a --> node_b

    %% === STYLES ===
    style node_id fill:#color,stroke:#color,color:#fff
```

### Node Types

| Type         | Shape       | Style         | Use Case                |
| ------------ | ----------- | ------------- | ----------------------- |
| `start`      | `(["..."])` | Green         | Project/phase beginning |
| `ai-task`    | `["..."]`   | Slate         | AI work, implementation |
| `human-task` | `["..."]`   | Indigo border | Human decision/action   |
| `condition`  | `{"..."}`   | Amber border  | Decision point, branch  |
| `blocker`    | `{{"..."}}` | Red           | Dead end, blocked path  |
| `end`        | `(["..."])` | Gray          | Completion point        |

### Style Reference

```mermaid
%% Start (emerald)
style node fill:#10b981,stroke:#059669,color:#fff,stroke-width:2px

%% AI Task (slate gray)
style node fill:#334155,stroke:#475569,color:#f8fafc,stroke-width:1px

%% Human Task (indigo border)
style node fill:#1e293b,stroke:#6366f1,color:#f8fafc,stroke-width:2px

%% Condition (amber border)
style node fill:#0f172a,stroke:#f59e0b,color:#fbbf24,stroke-width:2px

%% Blocker (red)
style node fill:#450a0a,stroke:#dc2626,color:#fca5a5,stroke-width:2px

%% End (gray)
style node fill:#64748b,stroke:#475569,color:#fff,stroke-width:2px
```

---

## AI Instructions Summary

1. **Read** `vizvibe.mmd` at the start of each session to understand context
2. **Update** after completing significant work
3. **Add future work** identified during the session as `[opened]` nodes
4. **Close nodes** when work is done or no longer relevant
5. **Delete nodes** that are trivial or mistaken
6. **Maintain relationships** — connect dependent tasks, keep independent tasks parallel
7. **Keep it high-level** — this is a map, not a changelog
