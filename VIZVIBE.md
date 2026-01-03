# VIZVIBE.md - Trajectory Management Guide

This document provides instructions for AI assistants on how to maintain the `trajectory.mmd` file as a **context map** for the project.

---

## Core Principles

### 1. Graph-Based History

Maintain the project history as a **graph structure** in `trajectory.mmd`:

- **Doesn't have to be a tree** — cycles and multiple paths are allowed
- Captures the evolution of the project at a **high level**
- Shows decision points, experiments, and outcomes

### 2. Project Goals

The trajectory should clearly state:

- **Ultimate goal**: The final objective of the project
- **Current goal**: What we're working toward right now (if known)

Place these as prominent nodes or comments at the top of the graph.

### 3. Future Work as Parallel Branches

When identifying future tasks from the current session:

- Add them as **parallel nodes** under a common parent (branch point)
- Future tasks can be specific implementations OR hypotheses to validate
- If already well-documented, no need to add duplicates

### 4. Dependency Relationships

Be precise about task relationships:

- **Dependent tasks**: Connected in sequence (A → B means B depends on A)
- **Independent tasks**: Connected only to their parent, NOT to each other
- Don't connect unrelated tasks just because they're "next"

```mermaid
%% CORRECT: Independent tasks branch from parent
parent --> task_a
parent --> task_b
parent --> task_c

%% WRONG: Don't chain independent tasks
parent --> task_a --> task_b --> task_c
```

### 5. Only Important Context

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

If the existing `trajectory.mmd` seems **incorrectly structured** based on your new understanding of the project:

- You **may restructure** the graph to better reflect the actual context
- Reorganize nodes and edges to show the true relationships
- This is not "rewriting history" — it's correcting a previously inaccurate map

Common reasons to restructure:

- Nodes were connected that shouldn't be (false dependencies)
- Parallel work was incorrectly shown as sequential
- The graph doesn't match the actual project evolution
- Key context was missing or misrepresented

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

1. **Read** `trajectory.mmd` at the start of each session to understand context
2. **Update** after completing significant work
3. **Add future work** identified during the session as `[opened]` nodes
4. **Close nodes** when work is done or no longer relevant
5. **Delete nodes** that are trivial or mistaken
6. **Maintain relationships** — connect dependent tasks, keep independent tasks parallel
7. **Keep it high-level** — this is a map, not a changelog
