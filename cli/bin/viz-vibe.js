#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const commands = {
  init: initProject,
  help: showHelp
};

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  if (commands[command]) {
    commands[command](args.slice(1));
  } else {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Viz Vibe CLI - AI workflow trajectory tracking

Usage:
  viz-vibe <command>

Commands:
  init    Initialize Viz Vibe in current project
  help    Show this help message

Examples:
  npx @viz-vibe/cli init
  viz-vibe init
`);
}

function initProject() {
  const projectDir = process.cwd();

  console.log('Initializing Viz Vibe...\n');

  const files = [
    {
      src: 'settings.json',
      dest: path.join('.claude', 'settings.json')
    },
    {
      src: 'update-trajectory.js',
      dest: path.join('.claude', 'hooks', 'update-trajectory.js')
    },
    {
      src: 'trajectory.mmd',
      dest: 'trajectory.mmd'
    },
    {
      src: 'VIZVIBE.md',
      dest: 'VIZVIBE.md'
    }
  ];

  let created = 0;
  let skipped = 0;

  for (const file of files) {
    const destPath = path.join(projectDir, file.dest);
    const destDir = path.dirname(destPath);

    // Create directory if needed
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Skip if file already exists
    if (fs.existsSync(destPath)) {
      console.log(`  [skip] ${file.dest} (already exists)`);
      skipped++;
      continue;
    }

    // Copy template
    const srcPath = path.join(TEMPLATES_DIR, file.src);
    const content = fs.readFileSync(srcPath, 'utf-8');
    fs.writeFileSync(destPath, content);
    console.log(`  [create] ${file.dest}`);
    created++;
  }

  console.log(`
Done! Created ${created} file(s), skipped ${skipped} file(s).

Next steps:
  1. Start Claude Code in this project
  2. Work normally - trajectory will auto-update on each response
  3. Open trajectory.mmd to see your work history

For VS Code users:
  Install the "Viz Vibe" extension for graph visualization.
`);
}

main();
