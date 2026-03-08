#!/usr/bin/env node

/**
 * Lean Plane CE MCP Server (Multi-Instance)
 *
 * Direct PostgreSQL access to Plane CE databases.
 * Supports multiple Plane instances (personal, nts) via `instance` param.
 * Recurrence engine in LifeDB sidecar table.
 *
 * Env: PLANE_PERSONAL_DB_HOST, PLANE_NTS_DB_HOST, LIFEDB_URL, etc.
 * Legacy: PLANE_DB_HOST (maps to personal instance)
 *
 * Tools (9):
 *   query           — Run arbitrary SELECT against Plane's database
 *   list_projects   — List projects with issue counts
 *   list_issues     — List issues with filters
 *   get_issue       — Get single issue with full details
 *   create_issue    — Create an issue
 *   update_issue    — Update issue fields
 *   complete_issue  — Mark issue(s) as complete (triggers recurrence)
 *   search_issues   — Full-text search across issues
 *   tasks_due       — Cross-instance view of due/overdue tasks
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { shutdown } from './db.js';
import {
  listProjects,
  listIssues,
  getIssue,
  createIssue,
  updateIssue,
  completeIssue,
  searchIssues,
  rawQuery,
  tasksDue,
} from './queries.js';

const instanceParam = z
  .enum(['personal', 'nts'])
  .optional()
  .default('personal')
  .describe('Plane instance: personal or nts (default: personal)');

const server = new McpServer({
  name: 'plane',
  version: '2.0.0',
});

server.tool(
  'query',
  'Run a read-only SQL query against the Plane database. Supports SELECT, WITH, EXPLAIN.',
  {
    sql: z.string().describe('SQL query (SELECT/WITH/EXPLAIN only)'),
    instance: instanceParam,
  },
  async ({ sql, instance }) => {
    try {
      const result = await rawQuery(sql, instance);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

server.tool(
  'list_projects',
  'List all active projects in the workspace with open/total issue counts.',
  {
    instance: instanceParam,
  },
  async ({ instance }) => {
    try {
      const result = await listProjects(instance);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

server.tool(
  'list_issues',
  'List issues with optional filters. Returns compact one-liner format.',
  {
    project: z.string().optional().describe('Project identifier or name'),
    state: z.string().optional().describe('State name or group (backlog/unstarted/started/completed/cancelled)'),
    assignee: z.string().optional().describe('Assignee name or email (partial match)'),
    priority: z.string().optional().describe('Priority: urgent, high, medium, low, none'),
    label: z.string().optional().describe('Label name (partial match)'),
    limit: z.number().optional().default(50).describe('Max issues to return (default 50)'),
    instance: instanceParam,
  },
  async ({ instance, ...opts }) => {
    try {
      const result = await listIssues({ ...opts, instance });
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

server.tool(
  'get_issue',
  'Get a single issue with full details including assignees, labels, description.',
  {
    issue_id: z.string().describe('Issue UUID'),
    instance: instanceParam,
  },
  async ({ issue_id, instance }) => {
    try {
      const result = await getIssue(issue_id, instance);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

server.tool(
  'create_issue',
  'Create a new issue in a project.',
  {
    project: z.string().describe('Project identifier or name'),
    name: z.string().describe('Issue title'),
    priority: z.string().optional().describe('Priority: urgent, high, medium, low, none (default: none)'),
    state: z.string().optional().describe('State name or group (default: unstarted)'),
    assignee: z.string().optional().describe('Assignee name or email (partial match)'),
    description: z.string().optional().describe('Issue description (plain text)'),
    target_date: z.string().optional().describe('Due date (YYYY-MM-DD)'),
    start_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    labels: z.array(z.string()).optional().describe('Label names to attach'),
    instance: instanceParam,
  },
  async ({ instance, ...opts }) => {
    try {
      const result = await createIssue({ ...opts, instance });
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

server.tool(
  'update_issue',
  'Update an existing issue. Only provided fields are changed.',
  {
    issue_id: z.string().describe('Issue UUID'),
    name: z.string().optional().describe('New title'),
    priority: z.string().optional().describe('New priority: urgent, high, medium, low, none'),
    state: z.string().optional().describe('New state name or group'),
    assignee: z.string().optional().describe('New assignee name or email (empty string to unassign)'),
    target_date: z.string().optional().describe('New due date (YYYY-MM-DD, empty string to clear)'),
    start_date: z.string().optional().describe('New start date (YYYY-MM-DD, empty string to clear)'),
    instance: instanceParam,
  },
  async ({ issue_id, instance, ...updates }) => {
    try {
      const result = await updateIssue(issue_id, updates, instance);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

server.tool(
  'complete_issue',
  'Mark one or more issues as complete. Triggers recurrence if configured (spawns next instance automatically).',
  {
    issue_ids: z.array(z.string()).describe('Array of issue UUIDs to complete'),
    instance: instanceParam,
  },
  async ({ issue_ids, instance }) => {
    try {
      const result = await completeIssue(issue_ids, instance);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

server.tool(
  'search_issues',
  'Search issues by text across names and descriptions.',
  {
    text: z.string().describe('Search text (case-insensitive partial match)'),
    limit: z.number().optional().default(20).describe('Max results (default 20)'),
    instance: instanceParam,
  },
  async ({ text, limit, instance }) => {
    try {
      const result = await searchIssues(text, limit, instance);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

server.tool(
  'tasks_due',
  'Get all tasks due today or overdue across instances. Returns compact format sorted by date and priority.',
  {
    instance: z
      .enum(['personal', 'nts', 'all'])
      .optional()
      .default('all')
      .describe('Instance to query: personal, nts, or all (default: all)'),
  },
  async ({ instance }) => {
    try {
      const result = await tasksDue(instance);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
