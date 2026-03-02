#!/usr/bin/env node

/**
 * Lean Plane CE MCP Server
 *
 * Direct PostgreSQL access to Plane CE's database.
 * Agents get SQL-level efficiency; humans use Plane's web UI.
 * Same database, two interfaces.
 *
 * Env: PLANE_DB_HOST, PLANE_DB_PORT, PLANE_DB_USER, PLANE_DB_PASSWORD,
 *      PLANE_DB_NAME, PLANE_WORKSPACE_SLUG
 *
 * Tools (8):
 *   query           — Run arbitrary SELECT against Plane's database
 *   list_projects   — List projects with issue counts
 *   list_issues     — List issues with filters
 *   get_issue       — Get single issue with full details
 *   create_issue    — Create an issue
 *   update_issue    — Update issue fields
 *   complete_issue  — Mark issue(s) as complete
 *   search_issues   — Full-text search across issues
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
} from './queries.js';

const server = new McpServer({
  name: 'plane',
  version: '1.0.0',
});

// Tool: query
server.tool(
  'query',
  'Run a read-only SQL query against the Plane database. Supports SELECT, WITH, EXPLAIN.',
  {
    sql: z.string().describe('SQL query (SELECT/WITH/EXPLAIN only)'),
  },
  async ({ sql }) => {
    try {
      const result = await rawQuery(sql);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// Tool: list_projects
server.tool(
  'list_projects',
  'List all active projects in the workspace with open/total issue counts.',
  {},
  async () => {
    try {
      const result = await listProjects();
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// Tool: list_issues
server.tool(
  'list_issues',
  'List issues with optional filters. Returns compact one-liner format: priority, ID, name, assignee, due date, state.',
  {
    project: z.string().optional().describe('Project identifier or name'),
    state: z.string().optional().describe('State name or group (backlog/unstarted/started/completed/cancelled)'),
    assignee: z.string().optional().describe('Assignee name or email (partial match)'),
    priority: z.string().optional().describe('Priority: urgent, high, medium, low, none'),
    label: z.string().optional().describe('Label name (partial match)'),
    limit: z.number().optional().default(50).describe('Max issues to return (default 50)'),
  },
  async (opts) => {
    try {
      const result = await listIssues(opts);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// Tool: get_issue
server.tool(
  'get_issue',
  'Get a single issue with full details including assignees, labels, description.',
  {
    issue_id: z.string().describe('Issue UUID'),
  },
  async ({ issue_id }) => {
    try {
      const result = await getIssue(issue_id);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// Tool: create_issue
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
  },
  async (opts) => {
    try {
      const result = await createIssue(opts);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// Tool: update_issue
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
  },
  async ({ issue_id, ...updates }) => {
    try {
      const result = await updateIssue(issue_id, updates);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// Tool: complete_issue
server.tool(
  'complete_issue',
  'Mark one or more issues as complete. Sets state to the completed group and records completion timestamp.',
  {
    issue_ids: z.array(z.string()).describe('Array of issue UUIDs to complete'),
  },
  async ({ issue_ids }) => {
    try {
      const result = await completeIssue(issue_ids);
      return { content: [{ type: 'text', text: result }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// Tool: search_issues
server.tool(
  'search_issues',
  'Search issues by text across names and descriptions.',
  {
    text: z.string().describe('Search text (case-insensitive partial match)'),
    limit: z.number().optional().default(20).describe('Max results (default 20)'),
  },
  async ({ text, limit }) => {
    try {
      const result = await searchIssues(text, limit);
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

// Graceful shutdown
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
