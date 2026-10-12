import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const rootDir = process.cwd();
const zip = new JSZip();

// Ignore patterns for fresh GitHub & Vercel release
const ignoreList = [
  'node_modules',
  'dist',
  'dev-dist',
  '.git',
  '.vercel',
  '.DS_Store',
  'om-lifeos-clean-github-vercel.zip'
];

function shouldInclude(filePath) {
  const rel = path.relative(rootDir, filePath);
  if (!rel) return true;
  const parts = rel.split(path.sep);
  for (const part of parts) {
    if (ignoreList.includes(part)) return false;
    if (part.endsWith('.zip')) return false;
  }
  return true;
}

function addDirectoryToZip(dirPath, zipFolder) {
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    if (!shouldInclude(fullPath)) continue;

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const subFolder = zipFolder.folder(item);
      addDirectoryToZip(fullPath, subFolder);
    } else {
      const content = fs.readFileSync(fullPath);
      zipFolder.file(item, content);
    }
  }
}

async function createCleanZip() {
  console.log('Packaging clean and fresh source code for GitHub & Vercel...');
  addDirectoryToZip(rootDir, zip);

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  const rootZipPath = path.join(rootDir, 'om-lifeos-clean-github-vercel.zip');
  fs.writeFileSync(rootZipPath, content);
  console.log(`✓ Created root archive: ${rootZipPath} (${(content.length / 1024 / 1024).toFixed(2)} MB)`);

  // Also put in public/ so it can be downloaded via browser
  const publicDir = path.join(rootDir, 'public');
  if (fs.existsSync(publicDir)) {
    const publicZipPath = path.join(publicDir, 'om-lifeos-clean-github-vercel.zip');
    fs.writeFileSync(publicZipPath, content);
    console.log(`✓ Saved public downloadable copy: ${publicZipPath}`);
  }
}

createCleanZip().catch(err => {
  console.error('Failed to create zip:', err);
  process.exit(1);
});
