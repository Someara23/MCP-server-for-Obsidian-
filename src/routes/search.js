import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolvePath, toRelativePath, getVaultPath } from '../utils.js';

const router = Router();

/**
 * GET /search
 * Full-text search across markdown files.
 * Query params: q (required), path (scope to subfolder), limit (default 20)
 */
router.get('/', async (req, res, next) => {
  try {
    const { q, limit: limitStr } = req.query;
    const searchPath = req.query.path || '';

    if (!q) {
      return res.status(400).json({ error: 'Missing required query parameter: q' });
    }

    const limit = parseInt(limitStr) || 20;
    const startDir = resolvePath(searchPath);
    const results = [];
    const needle = q.toLowerCase();

    await searchDir(startDir, needle, results, limit);

    res.json(results);
  } catch (err) {
    next(err);
  }
});

async function searchDir(dir, needle, results, limit) {
  if (results.length >= limit) return;

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= limit) return;

    const fullPath = path.join(dir, entry.name);

    // Skip hidden dirs and system folders
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '_archive') {
      continue;
    }

    if (entry.isDirectory()) {
      await searchDir(fullPath, needle, results, limit);
    } else if (entry.name.endsWith('.md')) {
      const matches = await searchFile(fullPath, needle);
      if (matches.length > 0) {
        results.push({
          path: toRelativePath(fullPath),
          matches,
        });
      }
    }
  }
}

async function searchFile(filePath, needle) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(needle)) {
        matches.push({
          line: lines[i].trim(),
          lineNumber: i + 1,
        });
      }
    }

    return matches;
  } catch {
    return [];
  }
}

export default router;
