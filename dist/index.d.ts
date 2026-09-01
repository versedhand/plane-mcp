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
export {};
