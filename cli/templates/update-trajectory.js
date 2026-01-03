#!/usr/bin/env node

/**
 * Stop Hook: Automatic Trajectory Update
 *
 * This hook triggers after Claude completes a response.
 * It instructs Claude to update trajectory.mmd with the work done.
 *
 * State management:
 * - "idle": Normal conversation, should trigger update
 * - "updating": Currently updating trajectory, should skip and reset to idle
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(process.cwd(), '.claude', 'hooks', 'state.json');

function getState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      return data.mode || 'idle';
    }
  } catch (e) {}
  return 'idle';
}

function setState(mode) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ mode, updatedAt: new Date().toISOString() }));
}

// Read stdin
let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('readable', () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    inputData += chunk;
  }
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(inputData);

    // Prevent infinite loop: if already in hook continuation, let Claude stop
    if (input.stop_hook_active) {
      process.exit(0);
    }

    const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd;
    const trajectoryPath = path.join(projectDir, 'trajectory.mmd');
    const vizvibePath = path.join(projectDir, 'VIZVIBE.md');

    // Check if trajectory.mmd exists
    if (!fs.existsSync(trajectoryPath)) {
      process.exit(0);
    }

    // Check if VIZVIBE.md exists (instructions file)
    if (!fs.existsSync(vizvibePath)) {
      process.exit(0);
    }

    // Analyze transcript to determine if update is needed
    const transcriptPath = input.transcript_path;
    if (transcriptPath && fs.existsSync(transcriptPath)) {
      const transcript = fs.readFileSync(transcriptPath, 'utf-8');
      const lines = transcript.trim().split('\n').filter(Boolean);

      // Skip if conversation is too short (likely just a question)
      if (lines.length < 4) {
        process.exit(0);
      }
    }

    // State-based duplicate prevention
    const currentState = getState();

    if (currentState === 'updating') {
      // Just finished updating trajectory, reset to idle and skip
      setState('idle');
      process.exit(0);
    }

    // Set state to updating before requesting trajectory update
    setState('updating');

    // Output instruction for Claude to continue and update trajectory
    const response = {
      decision: "block",
      reason: `Task completed. Please update trajectory.mmd.

Refer to VIZVIBE.md format guide:
1. Add new node representing the work just done
2. Choose appropriate node type (ai-task, condition, blocker, etc.)
3. Connect with edges to existing nodes
4. Add style definition

Add only 1-2 key nodes concisely.`
    };

    process.stdout.write(JSON.stringify(response));
    process.exit(0);

  } catch (error) {
    // On error, allow Claude to stop normally
    process.exit(0);
  }
});
