import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

const indexHtmlPath = path.join(distDir, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  console.error('Error: dist/index.html not found.');
  process.exit(1);
}

let html = fs.readFileSync(indexHtmlPath, 'utf8');
const assetsDir = path.join(distDir, 'assets');

if (fs.existsSync(assetsDir)) {
  const assetFiles = fs.readdirSync(assetsDir);

  // 1. Inline CSS files
  for (const file of assetFiles) {
    if (file.endsWith('.css')) {
      const cssContent = fs.readFileSync(path.join(assetsDir, file), 'utf8');
      const cssRegex = new RegExp(`<link[^>]+href=["'](?:\\./|/)?assets/${file}["'][^>]*>`, 'g');
      html = html.replace(cssRegex, () => `<style>/* ${file} */\n${cssContent}</style>`);
    }
  }

  // 2. Inline JavaScript chunks
  for (const file of assetFiles) {
    if (file.endsWith('.js')) {
      const jsContent = fs.readFileSync(path.join(assetsDir, file), 'utf8');
      // Escape </script> inside script tags
      const safeJs = jsContent.replace(/<\/script>/gi, '<\\/script>');
      const scriptRegex = new RegExp(`<script[^>]+src=["'](?:\\./|/)?assets/${file}["'][^>]*></script>`, 'g');
      html = html.replace(scriptRegex, () => `<script type="module">/* ${file} */\n${safeJs}\n</script>`);
    }
  }
}

// Remove leftovers that point to files which do not exist in a standalone file
html = html.replace(/<link[^>]+rel=["']modulepreload["'][^>]*>\s*/g, '');
html = html.replace(/<link[^>]+rel=["']manifest["'][^>]*>\s*/g, '');
html = html.replace(/<script[^>]+id=["']vite-plugin-pwa:register-sw["'][^>]*><\/script>\s*/g, '');

// Write the complete standalone HTML to dist/
const outputDistPath = path.join(distDir, 'om-lifeos-complete.html');

fs.writeFileSync(outputDistPath, html, 'utf8');

const sizeMb = (fs.statSync(outputDistPath).size / 1024 / 1024).toFixed(2);
console.log(`✓ Successfully generated complete standalone HTML: ${outputDistPath} (${sizeMb} MB)`);
