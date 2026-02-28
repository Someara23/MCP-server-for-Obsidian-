# Vault API Server

REST API server providing HTTP access to an Obsidian vault's filesystem. Runs on the MacBook Air alongside the existing Obsidian MCP server. Primary consumer is n8n on GCP for background automation (audio transcription, PDF extraction, inbox pre-classification).

## Quick Start

```bash
cp .env.example .env   # Edit with your vault path and API token
npm install
npm start              # Production
npm run dev            # Development (auto-restart on changes)
```

## Architecture

Express.js server with ES modules. No database — state lives in memory + filesystem.

```
src/
├── index.js           # Entry point — Express app + file watcher startup
├── middleware/
│   └── auth.js        # Bearer token auth (all endpoints)
├── routes/
│   ├── files.js       # GET/POST/DELETE /files — CRUD operations
│   ├── upload.js      # POST /upload — multipart file upload
│   ├── download.js    # GET /download/* — binary file streaming
│   ├── changes.js     # GET /changes — recent file changes
│   ├── webhooks.js    # POST /webhooks/register & /unregister
│   └── search.js      # GET /search — full-text markdown search
├── watcher.js         # chokidar file watcher + webhook dispatcher
└── utils.js           # Path resolution, validation, helpers
```

## Key Conventions

- **ES modules** — all files use `import`/`export`, not `require()`
- **Path security** — every user-supplied path passes through `resolvePath()` in `src/utils.js` which validates it stays within `VAULT_PATH`. Never bypass this.
- **Archive-on-delete** — `DELETE /files/*` moves files to `_archive/` with timestamp prefix, never permanently deletes
- **Text vs binary** — `isTextFile()` in `src/utils.js` determines handling. Text files return JSON with `content` field; binary files stream directly.
- **Auth** — all endpoints require `Authorization: Bearer <token>` header

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VAULT_PATH` | Yes | Absolute path to the Obsidian vault |
| `PORT` | No | Server port (default: 3002) |
| `API_TOKEN` | Yes | Bearer token for authentication |
| `ARCHIVE_PATH` | No | Archive subfolder name (default: `_archive`) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/files` | List directory contents |
| GET | `/files/*` | Read a file (text as JSON, binary as stream) |
| POST | `/files/*` | Create or update a file |
| DELETE | `/files/*` | Archive a file |
| POST | `/upload` | Upload files (multipart) |
| GET | `/download/*` | Download a file as binary stream |
| GET | `/changes` | List recent file changes since timestamp |
| POST | `/webhooks/register` | Register a webhook URL |
| POST | `/webhooks/unregister` | Remove a webhook URL |
| GET | `/search` | Full-text search across markdown files |

## Production Deployment

Uses pm2 for process management:
```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup    # Auto-start on boot
```
