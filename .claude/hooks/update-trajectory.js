#!/usr/bin/env node

/**
 * Stop Hook: Automatic Trajectory Update
 *
 * This hook triggers after Claude completes a response.
 * It instructs Claude to update trajectory.mmd with the work done.
 */

const fs = require('fs');
const path = require('path');

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
      // No trajectory file, skip update
      process.exit(0);
    }

    // Check if VIZVIBE.md exists (instructions file)
    if (!fs.existsSync(vizvibePath)) {
      // No instructions file, skip update
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

      // Check if trajectory was already updated in this session
      // by looking for recent Edit/Write tool calls to trajectory.mmd
      const recentLines = lines.slice(-10).join('\n');
      if (recentLines.includes('trajectory.mmd') &&
          (recentLines.includes('Edit') || recentLines.includes('Write'))) {
        // Already updated trajectory, don't ask again
        process.exit(0);
      }
    }

    // Output instruction for Claude to continue and update trajectory
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
    process.exit(0);

  } catch (error) {
    // On error, allow Claude to stop normally
    process.stderr.write(`Hook error: ${error.message}\n`);
    process.exit(0);
  }
});
