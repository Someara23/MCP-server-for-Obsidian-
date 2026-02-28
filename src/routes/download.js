import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { createReadStream } from 'node:fs';
import { resolvePath } from '../utils.js';

const router = Router();

/**
 * GET /download/*
 * Download any file from the vault as a binary stream.
 */
router.get('/*', async (req, res, next) => {
  try {
    const filePath = resolvePath(req.params[0]);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Cannot download a directory' });
    }

    const filename = path.basename(filePath);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    createReadStream(filePath).pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    next(err);
  }
});

export default router;
