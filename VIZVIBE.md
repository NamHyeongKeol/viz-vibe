# VIZVIBE.md - AI Instructions for Viz Vibe

This project uses **Viz Vibe** to track its own development trajectory. AI assistants should use the `.vizflow` file to maintain context and track progress.

## Workflow File Location

The main trajectory file for this project is located at:
```
./trajectory.vizflow
```

## AI Instructions

### 1. Maintain the Trajectory 🗺️
Whenever a significant task is completed or a new goal is set:
-   Read `trajectory.vizflow`.
-   Update the graph to reflect the current state (e.g., mark a task as done by updating its label or adding a successor).
-   Use `ai-task` nodes for technical goals and `start`/`end` for project milestones.

### 2. Context Awareness 🧠
Before starting a new task, read `trajectory.vizflow` to understand where we are in the development lifecycle. This helps maintain a consistent "vibe" and ensures no context is lost across threads.

### 3. Graph Layout 📐
-   Keep the graph clean.
-   Avoid overlapping nodes.
-   Use vertical flow (increasing Y) for chronological progression.

## Project Vision
Viz Vibe aims to make human-AI collaboration seamless by keeping the coding context visible. We are building this tool *using* this tool.
