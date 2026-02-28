import path from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.yaml', '.yml', '.csv',
  '.html', '.css', '.js', '.ts', '.xml', '.svg',
  '.ini', '.cfg', '.conf', '.toml', '.env',
]);

export function getVaultPath() {
  return path.resolve(process.env.VAULT_PATH);
}

/**
 * Resolves a relative vault path to an absolute filesystem path.
 * Throws if the resolved path escapes the vault directory.
 */
export function resolvePath(relativePath) {
  const vaultPath = getVaultPath();
  const resolved = path.resolve(vaultPath, relativePath);
  if (!resolved.startsWith(vaultPath + path.sep) && resolved !== vaultPath) {
    const err = new Error('Path outside vault');
    err.status = 403;
    throw err;
  }
  return resolved;
}

/**
 * Returns the vault-relative path from an absolute path.
 */
export function toRelativePath(absolutePath) {
  return path.relative(getVaultPath(), absolutePath);
}

/**
 * Checks whether a file should be treated as text based on its extension.
 */
export function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Generates an archive path for a file being "deleted" (moved to archive).
 * Format: {VAULT_PATH}/{ARCHIVE_PATH}/{ISO-timestamp}_{filename}
 */
export function getArchivePath(relativePath) {
  const vaultPath = getVaultPath();
  const archiveDir = process.env.ARCHIVE_PATH || '_archive';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.basename(relativePath);
  return path.join(vaultPath, archiveDir, `${timestamp}_${filename}`);
}
