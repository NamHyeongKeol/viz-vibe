#!/usr/bin/env node
/**
 * Viz Vibe - Unified Build Script
 * 
 * Builds both the VSCode extension and webview using esbuild.
 * 
 * Usage:
 *   node esbuild.js              # Development build
 *   node esbuild.js --watch      # Watch mode
 *   node esbuild.js --production # Production build (minified)
 *   node esbuild.js --serve      # Web development server
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const serve = process.argv.includes('--serve');

// Paths
const VSCODE_EXT_DIR = path.join(__dirname, 'vscode-extension');
const SHARED_WEBVIEW_DIR = path.join(__dirname, 'shared', 'webview');
const DIST_DIR = path.join(VSCODE_EXT_DIR, 'dist');
const WEBVIEW_DIST_DIR = path.join(DIST_DIR, 'webview');

// Ensure dist directories exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Problem matcher plugin for VSCode
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[esbuild] Build started...');
    });
    build.onEnd(result => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`);
        }
      });
      if (result.errors.length === 0) {
        console.log('[esbuild] Build finished successfully');
      }
    });
  }
};

/**
 * Copy static files (HTML template)
 */
function copyStaticFiles({ inlineAssets, allowMissing = false }) {
  ensureDir(WEBVIEW_DIST_DIR);

  // Read and process HTML template
  const htmlPath = path.join(SHARED_WEBVIEW_DIR, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  if (inlineAssets) {
    const stylesPath = path.join(WEBVIEW_DIST_DIR, 'styles.css');
    const platformPath = path.join(WEBVIEW_DIST_DIR, 'platform.js');
    const appPath = path.join(WEBVIEW_DIST_DIR, 'app.js');

    const missing = [stylesPath, platformPath, appPath].filter(filePath => !fs.existsSync(filePath));
    if (missing.length > 0) {
      if (allowMissing) {
        return;
      }
      throw new Error(`[esbuild] Missing webview assets: ${missing.join(', ')}`);
    }

    const styles = fs.readFileSync(stylesPath, 'utf8');
    const platform = fs.readFileSync(platformPath, 'utf8');
    const app = fs.readFileSync(appPath, 'utf8');

    html = html.replace(
      /<link\s+[^>]*href=["']\{\{stylesUri\}\}["'][^>]*>/i,
      `<style>\n${styles}\n</style>`
    );
    html = html.replace(
      /<script\s+[^>]*src=["']\{\{platformUri\}\}["'][^>]*>\s*<\/script>/i,
      `<script>\n${platform}\n</script>`
    );
    html = html.replace(
      /<script\s+[^>]*src=["']\{\{appUri\}\}["'][^>]*>\s*<\/script>/i,
      `<script>\n${app}\n</script>`
    );
  } else {
    // Replace placeholders with relative paths for bundled files
    html = html.replace('{{stylesUri}}', './styles.css');
    html = html.replace('{{platformUri}}', './platform.js');
    html = html.replace('{{appUri}}', './app.js');
  }

  fs.writeFileSync(path.join(WEBVIEW_DIST_DIR, 'index.html'), html);
  console.log('[esbuild] Copied index.html');
}

function createWebviewHtmlPlugin() {
  return {
    name: 'webview-inline-html',
    setup(build) {
      build.onEnd(result => {
        if (result.errors.length === 0) {
          copyStaticFiles({ inlineAssets: true, allowMissing: true });
        }
      });
    }
  };
}

/**
 * Build VSCode Extension (Node.js target)
 */
async function buildExtension() {
  const ctx = await esbuild.context({
    entryPoints: [path.join(VSCODE_EXT_DIR, 'src', 'extension.ts')],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: path.join(DIST_DIR, 'extension.js'),
    external: ['vscode'],
    logLevel: 'warning',
    plugins: [esbuildProblemMatcherPlugin]
  });

  if (watch) {
    await ctx.watch();
    console.log('[esbuild] Watching extension...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

/**
 * Build Webview (Browser target)
 */
async function buildWebview() {
  ensureDir(WEBVIEW_DIST_DIR);

  const webviewHtmlPlugins = watch ? [createWebviewHtmlPlugin()] : [];

  // Build platform.js
  const platformCtx = await esbuild.context({
    entryPoints: [path.join(SHARED_WEBVIEW_DIR, 'platform.js')],
    bundle: true,
    format: 'iife',
    minify: production,
    sourcemap: !production,
    platform: 'browser',
    outfile: path.join(WEBVIEW_DIST_DIR, 'platform.js'),
    logLevel: 'warning',
    plugins: [esbuildProblemMatcherPlugin, ...webviewHtmlPlugins]
  });

  // Build app.js
  const appCtx = await esbuild.context({
    entryPoints: [path.join(SHARED_WEBVIEW_DIR, 'app.js')],
    bundle: true,
    format: 'iife',
    minify: production,
    sourcemap: !production,
    platform: 'browser',
    outfile: path.join(WEBVIEW_DIST_DIR, 'app.js'),
    logLevel: 'warning',
    plugins: [esbuildProblemMatcherPlugin, ...webviewHtmlPlugins]
  });

  // Build CSS
  const cssCtx = await esbuild.context({
    entryPoints: [path.join(SHARED_WEBVIEW_DIR, 'styles.css')],
    bundle: true,
    minify: production,
    outfile: path.join(WEBVIEW_DIST_DIR, 'styles.css'),
    logLevel: 'warning',
    plugins: [esbuildProblemMatcherPlugin, ...webviewHtmlPlugins]
  });

  if (watch) {
    await Promise.all([
      platformCtx.watch(),
      appCtx.watch(),
      cssCtx.watch()
    ]);
    console.log('[esbuild] Watching webview...');
  } else {
    await Promise.all([
      platformCtx.rebuild(),
      appCtx.rebuild(),
      cssCtx.rebuild()
    ]);
    await Promise.all([
      platformCtx.dispose(),
      appCtx.dispose(),
      cssCtx.dispose()
    ]);
  }

  if (!watch) {
    copyStaticFiles({ inlineAssets: true });
  }
}

/**
 * Start development server for web testing
 */
async function startDevServer() {
  ensureDir(WEBVIEW_DIST_DIR);
  copyStaticFiles({ inlineAssets: false });

  const ctx = await esbuild.context({
    entryPoints: [
      path.join(SHARED_WEBVIEW_DIR, 'platform.js'),
      path.join(SHARED_WEBVIEW_DIR, 'app.js'),
      path.join(SHARED_WEBVIEW_DIR, 'styles.css')
    ],
    bundle: true,
    format: 'iife',
    minify: false,
    sourcemap: true,
    platform: 'browser',
    outdir: WEBVIEW_DIST_DIR,
    logLevel: 'info',
    plugins: [esbuildProblemMatcherPlugin]
  });

  const { host, port } = await ctx.serve({
    servedir: WEBVIEW_DIST_DIR,
    port: 3000
  });

  console.log(`\n🚀 Dev server running at http://${host}:${port}`);
  console.log('   Open index.html in browser to test webview\n');
}

/**
 * Main build function
 */
async function main() {
  console.log(`\n📦 Viz Vibe Build (${production ? 'production' : 'development'})\n`);

  if (serve) {
    await startDevServer();
  } else {
    await Promise.all([
      buildExtension(),
      buildWebview()
    ]);

    if (!watch) {
      console.log('\n✅ Build complete!\n');
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
