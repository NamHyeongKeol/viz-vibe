# VIZVIBE.md - Trajectory Management Guide

This file is installed by Viz Vibe to help AI assistants maintain your project's trajectory.

For the complete guide, see: https://github.com/NamHyeongKeol/viz-vibe/blob/main/VIZVIBE.md

---

## Quick Start

### File Location

```
./trajectory.mmd
```

### Node States

- `[opened]` — TODO: planned but not started
- `[closed]` — DONE: completed, blocked, or no longer needed

### When to Update

- ✅ Complete significant work
- ✅ Hit a dead end (valuable context!)
- ✅ Identify future work
- ❌ Trivial fixes (don't add)

### Graph Structure

- Use parallel branches for independent tasks
- Only connect tasks that have real dependencies
- Cycles are allowed for iterative work

### AI Instructions

1. Read `trajectory.mmd` at session start
2. Update after significant work
3. Add future work as `[opened]` nodes
4. Close or delete nodes as needed
5. Keep it high-level — this is a map, not a changelog
