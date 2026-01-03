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
const LOG_FILE = path.join(process.cwd(), '.claude', 'hooks', 'hook.log');

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

function log(msg) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`);
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
    log('Hook triggered');
    const input = JSON.parse(inputData);
    log(`Input: stop_hook_active=${input.stop_hook_active}, cwd=${input.cwd}`);

    // Prevent infinite loop: if already in hook continuation, let Claude stop
    if (input.stop_hook_active) {
      log('stop_hook_active=true, exiting');
      process.exit(0);
    }

    const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd;
    const trajectoryPath = path.join(projectDir, 'trajectory.mmd');
    const vizvibePath = path.join(projectDir, 'VIZVIBE.md');

    // Check if trajectory.mmd exists
    if (!fs.existsSync(trajectoryPath)) {
      log(`trajectory.mmd not found at ${trajectoryPath}, skipping`);
      process.exit(0);
    }
    log(`Found trajectory.mmd at ${trajectoryPath}`);

    // Check if VIZVIBE.md exists (instructions file)
    if (!fs.existsSync(vizvibePath)) {
      log(`VIZVIBE.md not found at ${vizvibePath}, skipping`);
      process.exit(0);
    }
    log(`Found VIZVIBE.md at ${vizvibePath}`);

    // Analyze transcript to determine if update is needed
    const transcriptPath = input.transcript_path;
    if (transcriptPath && fs.existsSync(transcriptPath)) {
      const transcript = fs.readFileSync(transcriptPath, 'utf-8');
      const lines = transcript.trim().split('\n').filter(Boolean);

      // Skip if conversation is too short (likely just a question)
      if (lines.length < 4) {
        log(`Conversation too short (${lines.length} lines), skipping`);
        process.exit(0);
      }
      log(`Transcript has ${lines.length} lines`);
    }

    // State-based duplicate prevention
    const currentState = getState();
    log(`Current state: ${currentState}`);

    if (currentState === 'updating') {
      // Just finished updating trajectory, reset to idle and skip
      setState('idle');
      log('State was "updating", reset to "idle" and skipping');
      process.exit(0);
    }

    // Set state to updating before requesting trajectory update
    setState('updating');
    log('State set to "updating"');

    // Output instruction for Claude to continue and update trajectory
    log('Sending block response to update trajectory');
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
    log('Response sent, exiting');
    process.exit(0);

  } catch (error) {
    // On error, allow Claude to stop normally
    process.stderr.write(`Hook error: ${error.message}\n`);
    process.exit(0);
  }
});
