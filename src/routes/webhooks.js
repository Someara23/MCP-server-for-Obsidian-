import { Router } from 'express';
import { registerWebhook, unregisterWebhook, listWebhooks } from '../watcher.js';

const router = Router();

/**
 * POST /webhooks/register
 * Register a URL to receive file change notifications.
 * Body: { url, events?: ['add', 'change', 'unlink'] }
 */
router.post('/register', (req, res) => {
  const { url, events } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing required field: url' });
  }

  registerWebhook(url, events);
  res.json({ registered: true, url });
});

/**
 * POST /webhooks/unregister
 * Remove a registered webhook.
 * Body: { url }
 */
router.post('/unregister', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing required field: url' });
  }

  const removed = unregisterWebhook(url);
  if (!removed) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  res.json({ unregistered: true, url });
});

/**
 * GET /webhooks
 * List all registered webhooks.
 */
router.get('/', (_req, res) => {
  res.json(listWebhooks());
});

export default router;
