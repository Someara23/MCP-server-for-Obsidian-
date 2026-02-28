import chokidar from 'chokidar';
import path from 'node:path';
import { getVaultPath, toRelativePath } from './utils.js';

const MAX_EVENTS = 1000;
const changeBuffer = [];
const webhooks = new Map(); // url -> { url, events }

/**
 * Starts the chokidar file watcher on the vault directory.
 */
export function startWatcher() {
  const vaultPath = getVaultPath();
  const archivePath = process.env.ARCHIVE_PATH || '_archive';

  const watcher = chokidar.watch(vaultPath, {
    ignoreInitial: true,
    ignored: [
      path.join(vaultPath, '.obsidian', '**'),
      path.join(vaultPath, archivePath, '**'),
      path.join(vaultPath, '.git', '**'),
      path.join(vaultPath, 'node_modules', '**'),
      /(^|[\/\\])\../, // dotfiles like .DS_Store
    ],
  });

  for (const eventType of ['add', 'change', 'unlink']) {
    watcher.on(eventType, (filePath) => {
      const event = {
        path: toRelativePath(filePath),
        event: eventType,
        timestamp: new Date().toISOString(),
      };

      // Ring buffer — drop oldest when full
      if (changeBuffer.length >= MAX_EVENTS) {
        changeBuffer.shift();
      }
      changeBuffer.push(event);

      dispatchWebhooks(event);
    });
  }

  watcher.on('error', (err) => {
    console.error('File watcher error:', err);
  });

  watcher.on('ready', () => {
    console.log('File watcher ready');
  });
}

/**
 * Returns all change events since the given ISO timestamp.
 */
export function getChangesSince(sinceISO) {
  const since = new Date(sinceISO);
  return changeBuffer.filter((e) => new Date(e.timestamp) > since);
}

/**
 * Registers a webhook URL to receive file change notifications.
 */
export function registerWebhook(url, events) {
  webhooks.set(url, { url, events: events || ['add', 'change', 'unlink'] });
}

/**
 * Removes a registered webhook URL.
 */
export function unregisterWebhook(url) {
  return webhooks.delete(url);
}

/**
 * Returns all currently registered webhooks.
 */
export function listWebhooks() {
  return Array.from(webhooks.values());
}

/**
 * Fire-and-forget POST to all registered webhooks matching this event type.
 */
async function dispatchWebhooks(event) {
  for (const [url, hook] of webhooks) {
    if (!hook.events.includes(event.event)) continue;

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      console.error(`Webhook delivery failed for ${url}:`, err.message);
    }
  }
}
