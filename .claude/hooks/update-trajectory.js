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

// 즉시 실행 확인용 로그 (stdin 읽기 전)
const immediateLog = path.join(process.cwd(), '.claude', 'hooks', 'hook-started.log');
fs.appendFileSync(immediateLog, `[${new Date().toISOString()}] Hook script started\n`);

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
  const logFile = path.join(process.env.CLAUDE_PROJECT_DIR || '.', '.claude', 'hooks', 'hook.log');
  const log = (msg) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
  };

  try {
    log('Hook triggered');
    const input = JSON.parse(inputData);
    log(`Input: stop_hook_active=${input.stop_hook_active}, cwd=${input.cwd}`);

    // Prevent infinite loop: if already in hook continuation, let Claude stop
    if (input.stop_hook_active) {
      // Reset state to idle when hook continuation ends
      if (getState() === 'updating') {
        setState('idle');
        log('stop_hook_active=true, reset state to idle');
      }
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
      reason: `작업이 완료되었습니다. trajectory.mmd 파일을 업데이트해주세요.

VIZVIBE.md의 형식 가이드를 참고하여:
1. 방금 수행한 작업을 나타내는 새 노드 추가
2. 적절한 노드 타입 선택 (ai-task, condition, blocker 등)
3. 기존 노드와 엣지로 연결
4. 스타일 정의 추가

간결하게 1-2개의 핵심 노드만 추가하세요.`
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
