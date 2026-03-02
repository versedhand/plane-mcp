# plane-mcp

Lean MCP server for [Plane CE](https://plane.so) — direct PostgreSQL access for AI agents.

8 tools, ~1600 token schema footprint. Compare to the official Plane MCP server's 96 tools / ~25,000 tokens.

## Architecture

- **Agents** connect via plane-mcp → direct PostgreSQL queries (fast, low-token)
- **Humans** use Plane CE web UI (boards, Gantt, dashboards)
- **Same database** — both interfaces read/write the same PostgreSQL instance

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

### 3. Configure MCP

In `.mcp.json`:

```json
{
  "mcpServers": {
    "plane": {
      "command": "node",
      "args": ["/path/to/plane-mcp/dist/index.js"],
      "env": {
        "PLANE_DB_HOST": "127.0.0.1",
        "PLANE_DB_PORT": "5432",
        "PLANE_DB_USER": "plane_mcp",
        "PLANE_DB_PASSWORD": "...",
        "PLANE_DB_NAME": "plane",
        "PLANE_WORKSPACE_SLUG": "personal"
      }
    }
  }
}
```

### 4. Build

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
