# Cloudflare Named Tunnel Setup

Replaces the guest/quick tunnel (`cloudflared tunnel --url`) with an account-based named tunnel that gives you **static hostnames** for both the Vault API Server and the Obsidian MCP Server through a single tunnel.

## Prerequisites

- Cloudflare account (free tier works)
- A domain added to Cloudflare with Cloudflare DNS (nameservers pointed to Cloudflare)
- `cloudflared` installed on the MacBook Air

> **Don't have a domain on Cloudflare?** The cheapest path: register one through [Cloudflare Registrar](https://dash.cloudflare.com/?to=/:account/domains/register) — domains are at cost (~$10/year for .com, ~$5 for .dev or .site). Cloudflare DNS is automatic when you register through them. You don't need to move your main domain — a dedicated tunnel domain works great.

## Step 1: Install cloudflared (if not already installed)

```bash
brew install cloudflared
```

## Step 2: Authenticate

```bash
cloudflared tunnel login
```

This opens a browser. Select the domain you want to use for tunnel hostnames. A certificate is saved to `~/.cloudflared/cert.pem`.

## Step 3: Create the named tunnel

```bash
cloudflared tunnel create vault
```

This outputs a **Tunnel UUID** and creates a credentials file at `~/.cloudflared/<UUID>.json`. Save the UUID — you need it for the config.

## Step 4: Create DNS routes

Create CNAME records pointing your subdomains to the tunnel:

```bash
cloudflared tunnel route dns vault api.YOUR_DOMAIN.com
cloudflared tunnel route dns vault mcp.YOUR_DOMAIN.com
```

This automatically creates CNAME records in Cloudflare DNS pointing each subdomain to `<UUID>.cfargotunnel.com`.

## Step 5: Configure the tunnel

Copy the example config from the repo:

```bash
cp ~/MCP-server-for-Obsidian-/cloudflared-config.example.yml ~/.cloudflared/config.yml
```

Edit `~/.cloudflared/config.yml` and replace the placeholders:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /Users/sean/.cloudflared/<TUNNEL_UUID>.json

ingress:
  # Vault API Server (port 3002)
  - hostname: api.YOUR_DOMAIN.com
    service: http://localhost:3002
    originRequest:
      noTLSVerify: true

  # Obsidian MCP Server
  - hostname: mcp.YOUR_DOMAIN.com
    service: http://localhost:<MCP_PORT>
    originRequest:
      noTLSVerify: true

  # Catch-all (required)
  - service: http_status:404
```

## Step 6: Test the tunnel

```bash
cloudflared tunnel run vault
```

In another terminal, verify both services are reachable:

```bash
# Vault API
curl https://api.YOUR_DOMAIN.com/health
# Should return: {"status":"ok"}

# MCP Server (test however appropriate for your MCP setup)
curl https://mcp.YOUR_DOMAIN.com/
```

## Step 7: Install as a system service

Once the tunnel is working, install it as a launchd service so it starts on boot:

```bash
cloudflared service install
```

This creates a LaunchDaemon that runs the tunnel automatically. It reads from `~/.cloudflared/config.yml`.

Verify it's running after a reboot:

```bash
# Check the service
sudo launchctl list | grep cloudflared

# Test the endpoint
curl https://api.YOUR_DOMAIN.com/health
```

## Step 8: Stop the old guest tunnel

Once the named tunnel is confirmed working, stop whatever process was running the old `cloudflared tunnel --url` command. You won't need it anymore.

## Updating n8n to use the new URL

In your n8n workflows on GCP, update the HTTP Request nodes:

- **Old:** `https://random-word-random-word.trycloudflare.com/...`
- **New:** `https://api.YOUR_DOMAIN.com/...`

The URL never changes again.

## Adding more services later

To route additional services through the same tunnel, just add more ingress rules to `~/.cloudflared/config.yml`:

```yaml
ingress:
  - hostname: api.YOUR_DOMAIN.com
    service: http://localhost:3002
  - hostname: mcp.YOUR_DOMAIN.com
    service: http://localhost:<MCP_PORT>
  - hostname: newservice.YOUR_DOMAIN.com
    service: http://localhost:XXXX
  - service: http_status:404
```

Then restart the tunnel:

```bash
cloudflared tunnel restart vault
# or if running as a service:
sudo launchctl stop com.cloudflare.cloudflared
sudo launchctl start com.cloudflare.cloudflared
```

## Architecture After Setup

```
Internet
  │
  ├── https://api.YOUR_DOMAIN.com ──┐
  │                                  │
  └── https://mcp.YOUR_DOMAIN.com ──┤
                                     │
                              Cloudflare Edge
                                     │
                              cloudflared tunnel
                              (MacBook Air)
                                     │
                     ┌───────────────┴───────────────┐
                     │                               │
              localhost:3002                   localhost:<MCP>
              Vault API Server               Obsidian MCP Server
                     │                               │
                     └───────────┬───────────────────┘
                                 │
                          The Journey (vault)
```

Both consumers (n8n on GCP, Claude on claude.ai) hit stable URLs that never change, regardless of Mac reboots or IP changes.
