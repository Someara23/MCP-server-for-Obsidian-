import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { resolvePath, toRelativePath, isTextFile, getArchivePath, getVaultPath } from '../utils.js';

const router = Router();

/**
 * GET /files
 * List directory contents.
 * Query params: path, extension, modifiedSince, recursive
 */
router.get('/', async (req, res, next) => {
  try {
    const dirRelative = req.query.path || '';
    const dirAbsolute = resolvePath(dirRelative);
    const extension = req.query.extension;
    const modifiedSince = req.query.modifiedSince ? new Date(req.query.modifiedSince) : null;
    const recursive = req.query.recursive === 'true';

    const entries = await listDir(dirAbsolute, recursive);
    let results = [];

    for (const entry of entries) {
      const stat = await fs.stat(entry.absolute);
      const item = {
        name: path.basename(entry.absolute),
        path: toRelativePath(entry.absolute),
        type: stat.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };

      if (extension && item.type === 'file' && !item.name.endsWith(extension)) continue;
      if (modifiedSince && stat.mtime < modifiedSince) continue;

      results.push(item);
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

async function listDir(dirAbsolute, recursive) {
  const dirents = await fs.readdir(dirAbsolute, { withFileTypes: true });
  let entries = [];
  for (const dirent of dirents) {
    const absolute = path.join(dirAbsolute, dirent.name);
    entries.push({ absolute, isDirectory: dirent.isDirectory() });
    if (recursive && dirent.isDirectory()) {
      entries = entries.concat(await listDir(absolute, true));
    }
  }
  return entries;
}

/**
 * GET /files/*
 * Read a single file. Text files return JSON; binary files stream.
 */
router.get('/*', async (req, res, next) => {
  try {
    const filePath = resolvePath(req.params[0]);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory. Use GET /files?path= to list.' });
    }

    if (isTextFile(filePath)) {
      const content = await fs.readFile(filePath, 'utf-8');
      res.json({
        content,
        path: toRelativePath(filePath),
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    } else {
      const contentType = mime.lookup(filePath) || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stat.size);
      const { createReadStream } = await import('node:fs');
      createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    next(err);
  }
});

/**
 * POST /files/*
 * Create or update a file. Accepts JSON { content } for text, or raw body for binary.
 */
router.post('/*', async (req, res, next) => {
  try {
    const filePath = resolvePath(req.params[0]);
    let created = false;

    try {
      await fs.access(filePath);
    } catch {
      created = true;
    }

    // Create parent directories if needed
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    if (req.body && typeof req.body.content === 'string') {
      await fs.writeFile(filePath, req.body.content, 'utf-8');
    } else {
      // Raw binary body — collect chunks
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      await new Promise((resolve, reject) => {
        req.on('end', resolve);
        req.on('error', reject);
      });
      await fs.writeFile(filePath, Buffer.concat(chunks));
    }

    const stat = await fs.stat(filePath);
    res.status(created ? 201 : 200).json({
      path: toRelativePath(filePath),
      size: stat.size,
      created,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /files/*
 * Archive a file (move to _archive/ with timestamp prefix).
 */
router.delete('/*', async (req, res, next) => {
  try {
    const filePath = resolvePath(req.params[0]);
    await fs.access(filePath);

    const archivePath = getArchivePath(req.params[0]);
    await fs.mkdir(path.dirname(archivePath), { recursive: true });
    await fs.rename(filePath, archivePath);

    res.json({
      archived: true,
      archivePath: toRelativePath(archivePath),
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    next(err);
  }
});

export default router;
