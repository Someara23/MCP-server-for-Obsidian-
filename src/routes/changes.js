import { Router } from 'express';
import { getChangesSince } from '../watcher.js';

const router = Router();

/**
 * GET /changes
 * Returns file change events since a given timestamp.
 * Query param: since (ISO 8601 timestamp, required)
 */
router.get('/', (req, res) => {
  const { since } = req.query;
  if (!since) {
    return res.status(400).json({ error: 'Missing required query parameter: since' });
  }

  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) {
    return res.status(400).json({ error: 'Invalid timestamp format. Use ISO 8601.' });
  }

  const events = getChangesSince(since);
  res.json(events);
});

export default router;
