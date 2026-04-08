const { readdir, readFile, writeFile, rm } = require('fs/promises');
const { extractAll, createPackage } = require('@electron/asar');
const { join } = require('path');

async function processFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const result = content.replace(/(\r?\n){2,}/g, '\n');
  await writeFile(filePath, result, 'utf-8');
}

async function walkDir(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) return walkDir(full);
    if (/\.(js|css|html)$/.test(entry.name)) return processFile(full);
  }));
}

module.exports = async ({ appOutDir }) => {
  const asarPath = join(appOutDir, 'resources', 'app.asar');
  const extractPath = join(appOutDir, 'resources', 'app-minified');
  
  extractAll(asarPath, extractPath);

  await walkDir(extractPath);
  await createPackage(extractPath, asarPath);
  await rm(extractPath, { recursive: true, force: true });
};
