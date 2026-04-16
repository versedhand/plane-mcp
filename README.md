# plane-mcp

Lean MCP server for [Plane CE](https://plane.so) — direct PostgreSQL access for AI agents.

8 tools, ~1600 token schema footprint. Compare to the official Plane MCP server's 96 tools / ~25,000 tokens.

## Architecture

- **Reads** go direct to PostgreSQL (fast, no API overhead)
- **Mutations** go through Plane's REST API (triggers email notifications, activity logs, webhooks)
- **Humans** use Plane CE web UI (boards, Gantt, dashboards)
- **Fallback**: if API credentials aren't configured, mutations fall back to direct SQL (no notifications)

When `PLANE_*_API_URL` and `PLANE_*_API_KEY` are set, `create_issue`, `update_issue`, and `complete_issue` use the REST API at `/api/v1/workspaces/{slug}/projects/{id}/work-items/`. All read operations (`list_issues`, `get_issue`, `search_issues`, `query`) always use direct SQL.

## Tools

| Tool | Type | Description |
|------|------|-------------|
| `query` | Read | Run arbitrary SELECT/WITH/EXPLAIN against Plane's database |
| `list_projects` | Read | List projects with open/total issue counts |
| `list_issues` | Read | List issues with filters (project, state, assignee, priority, label) |
| `get_issue` | Read | Full issue details with assignees, labels, description |
| `create_issue` | Write | Create issue with state resolution, sequence tracking, optional assignee |
| `update_issue` | Write | Partial update of fields including state transitions |
| `complete_issue` | Write | Batch mark issues as complete |
| `search_issues` | Read | Case-insensitive search across issue names and descriptions |

## Setup

### 1. Expose PostgreSQL

Add a `docker-compose.override.yml` alongside Plane's docker-compose:

```yaml
services:
  plane-db:
    ports:
      - "0.0.0.0:5432:5432"
```

Then recreate the DB container:

```bash
cd /opt/plane && docker compose up -d plane-db
```

### 2. Create database role

```sql
CREATE ROLE plane_mcp WITH LOGIN PASSWORD '<password>';
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO plane_mcp;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO plane_mcp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO plane_mcp;
```

Add to `pg_hba.conf` inside the data directory:

```
host plane plane_mcp 0.0.0.0/0 md5
```

Reload: `docker exec plane-plane-db-1 pg_ctl reload -D /var/lib/postgresql/data`

### 3. Create API token

In the Plane web UI, go to Profile Settings > Personal Access Tokens and create a token. Or create one in the database:

```sql
INSERT INTO api_tokens (id, token, label, user_type, user_id, workspace_id, description, is_active, is_service, created_at, updated_at, allowed_rate_limit)
VALUES (gen_random_uuid(), 'plane_api_<hex>', 'mcp-server', 0, '<user-uuid>', '<workspace-uuid>', 'MCP server', true, false, NOW(), NOW(), '60/minute');
```

### 4. Configure MCP

In `.mcp.json`:

```json
{
  "mcpServers": {
    "plane": {
      "command": "npx",
      "args": ["-y", "@versedhand/plane-mcp"],
      "env": {
        "PLANE_PERSONAL_DB_HOST": "127.0.0.1",
        "PLANE_PERSONAL_DB_PORT": "5432",
        "PLANE_PERSONAL_DB_USER": "plane_mcp",
        "PLANE_PERSONAL_DB_PASSWORD": "...",
        "PLANE_PERSONAL_DB_NAME": "plane",
        "PLANE_PERSONAL_WORKSPACE_SLUG": "personal",
        "PLANE_PERSONAL_API_URL": "https://plane.example.com",
        "PLANE_PERSONAL_API_KEY": "plane_api_..."
      }
    }
  }
}
```

The `API_URL` and `API_KEY` are optional. Without them, mutations fall back to direct SQL (no notifications).

### 5. Build

```bash
npm install
npm run build
```

## Output format

Compact one-liner for list operations:

```
[URGENT] OPS-12: Fix login bug | isaac | Due: 2026-03-05 | In Progress
[HIGH] OPS-8: Update docs | unassigned | Todo
```

Full detail for get_issue:

```
# OPS-12: Fix login bug
Priority: urgent | State: In Progress (started)
Assignees: Isaac (isaac@rirobinson.com)
Project: Operations
Labels: bug, frontend
Due: 2026-03-05
```

Table format for raw queries (same as LifeDB).

## SSH tunnel

If Plane's PostgreSQL isn't directly reachable (e.g., running on a Proxmox container without Tailscale), use an SSH tunnel:

```bash
ssh -f -N -L 15432:<container-ip>:5432 root@<proxmox-host>
```

Then set `PLANE_DB_PORT=15432`.
