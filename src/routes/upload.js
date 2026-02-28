import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { resolvePath, toRelativePath } from '../utils.js';

const router = Router();

// Store uploads in a temp directory, then move to vault
const upload = multer({ dest: '/tmp/vault-api-uploads' });

/**
 * POST /upload
 * Upload one or more files to a vault folder.
 * Query param: dest (target folder within vault, default "Inbox")
 * Files sent as multipart form data under field name "files".
 */
router.post('/', upload.array('files', 20), async (req, res, next) => {
  try {
    const dest = req.query.dest || 'Inbox';
    const destDir = resolvePath(dest);
    await fs.mkdir(destDir, { recursive: true });

    const results = [];
    for (const file of req.files) {
      const targetPath = path.join(destDir, file.originalname);
      await fs.rename(file.path, targetPath);
      const stat = await fs.stat(targetPath);
      results.push({
        path: toRelativePath(targetPath),
        size: stat.size,
      });
    }

    res.status(201).json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
