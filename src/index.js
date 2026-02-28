import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import auth from './middleware/auth.js';
import filesRouter from './routes/files.js';
import uploadRouter from './routes/upload.js';
import downloadRouter from './routes/download.js';
import changesRouter from './routes/changes.js';
import webhooksRouter from './routes/webhooks.js';
import searchRouter from './routes/search.js';
import { startWatcher } from './watcher.js';

// Validate required env vars
for (const key of ['VAULT_PATH', 'API_TOKEN']) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check (no auth — useful for monitoring and tunnel health checks)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(auth);

app.use('/files', filesRouter);
app.use('/upload', uploadRouter);
app.use('/download', downloadRouter);
app.use('/changes', changesRouter);
app.use('/webhooks', webhooksRouter);
app.use('/search', searchRouter);

// Global error handler
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  console.error(err);
  res.status(status).json({ error: err.message });
});

startWatcher();

app.listen(port, () => {
  console.log(`Vault API Server listening on port ${port}`);
  console.log(`Vault path: ${process.env.VAULT_PATH}`);
});
