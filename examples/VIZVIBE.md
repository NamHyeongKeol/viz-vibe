# VIZVIBE.md - AI Instructions for Viz Vibe

This file provides instructions to AI assistants (GitHub Copilot, Cursor, Claude, etc.) on how to interact with Viz Vibe workflows in this project.

## Workflow File Location

The main workflow file for this project is located at:
```
./examples/code-review.vizflow
```

## Workflow Structure

The `.vizflow` file is a JSON file with the following structure:

```json
{
  "version": "1.0",
  "nodes": [
    {
      "id": "unique_id",
      "type": "start|ai-task|condition|end",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "Node Label",
        "prompt": "AI task description (for ai-task type)"
      }
    }
  ],
  "edges": [
    { "id": "edge_id", "source": "node_id_1", "target": "node_id_2" }
  ]
}
```

## Node Types

| Type | Purpose | Required Data |
|------|---------|---------------|
| `start` | Entry point of workflow | `label` |
| `ai-task` | AI-powered task | `label`, `prompt` |
| `condition` | Decision/branching | `label`, `condition` |
| `end` | Exit point | `label` |

## AI Instructions

### Reading the Workflow
When I ask about the project status or workflow:
1. Read the `.vizflow` file to understand the current workflow state
2. Identify which nodes represent completed vs pending tasks
3. Summarize the workflow progress

### Modifying the Workflow
When I ask you to update the workflow:
1. Add new nodes with unique IDs (use format: `node_<timestamp>` or descriptive IDs)
2. Connect nodes with edges to maintain flow
3. Update node positions to avoid overlapping (increment Y by ~100 for vertical spacing)
4. Preserve existing node IDs to maintain edge connections

### Best Practices
- Always validate JSON syntax after modifications
- Keep node labels concise but descriptive
- Use meaningful prompts for `ai-task` nodes
- Maintain logical edge connections (start → tasks → end)

## Project-Specific Notes

<!-- Add your project-specific instructions for AI here -->
- This is a code review workflow example
- The workflow should follow: Analyze → Decision → (Refactor if needed) → Complete

## Current Status

- [ ] Initial analysis pending
- [ ] Refactoring decisions to be made
- [ ] Final review incomplete
