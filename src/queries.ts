import { query, execute } from './db.js';
import { randomUUID } from 'crypto';

const WORKSPACE_SLUG = process.env.PLANE_WORKSPACE_SLUG || 'personal';

// Cache workspace ID to avoid repeated lookups
let workspaceId: string | null = null;

async function getWorkspaceId(): Promise<string> {
  if (workspaceId) return workspaceId;
  const rows = await query(
    `SELECT id FROM workspaces WHERE slug = $1 AND deleted_at IS NULL`,
    [WORKSPACE_SLUG],
  );
  if (rows.length === 0) throw new Error(`Workspace '${WORKSPACE_SLUG}' not found`);
  workspaceId = rows[0].id as string;
  return workspaceId!;
}

export async function listProjects(): Promise<string> {
  const wsId = await getWorkspaceId();
  const rows = await query(
    `SELECT p.id, p.name, p.identifier,
       (SELECT count(*) FROM issues i WHERE i.project_id = p.id AND i.deleted_at IS NULL) as issue_count,
       (SELECT count(*) FROM issues i
        JOIN states s ON i.state_id = s.id
        WHERE i.project_id = p.id AND i.deleted_at IS NULL
        AND s.group NOT IN ('completed', 'cancelled')) as open_count
     FROM projects p
     WHERE p.workspace_id = $1 AND p.deleted_at IS NULL AND p.archived_at IS NULL
     ORDER BY p.name`,
    [wsId],
  );

  if (rows.length === 0) return 'No projects found.';

  const lines = rows.map(
    (r: any) => `${r.identifier} | ${r.name} | ${r.open_count}/${r.issue_count} open | id: ${r.id}`,
  );
  return lines.join('\n');
}

export async function listIssues(opts: {
  project?: string;
  state?: string;
  assignee?: string;
  priority?: string;
  label?: string;
  limit?: number;
}): Promise<string> {
  const wsId = await getWorkspaceId();
  const conditions = [`i.workspace_id = $1`, `i.deleted_at IS NULL`, `i.archived_at IS NULL`];
  const params: any[] = [wsId];
  let paramIdx = 2;

  if (opts.project) {
    conditions.push(`(p.identifier = $${paramIdx} OR p.name ILIKE $${paramIdx})`);
    params.push(opts.project);
    paramIdx++;
  }

  if (opts.state) {
    conditions.push(`(s.group = $${paramIdx} OR s.name ILIKE $${paramIdx})`);
    params.push(opts.state);
    paramIdx++;
  }

  if (opts.priority) {
    conditions.push(`i.priority = $${paramIdx}`);
    params.push(opts.priority);
    paramIdx++;
  }

  if (opts.assignee) {
    conditions.push(`EXISTS (
      SELECT 1 FROM issue_assignees ia
      JOIN users u ON ia.assignee_id = u.id
      WHERE ia.issue_id = i.id AND ia.deleted_at IS NULL
      AND (u.first_name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})
    )`);
    params.push(`%${opts.assignee}%`);
    paramIdx++;
  }

  if (opts.label) {
    conditions.push(`EXISTS (
      SELECT 1 FROM issue_labels il
      JOIN labels l ON il.label_id = l.id
      WHERE il.issue_id = i.id AND il.deleted_at IS NULL
      AND l.name ILIKE $${paramIdx}
    )`);
    params.push(`%${opts.label}%`);
    paramIdx++;
  }

  const limit = opts.limit || 50;

  const sql = `
    SELECT i.id, i.name, i.priority, i.sequence_id,
           i.start_date, i.target_date, i.completed_at,
           s.name as state_name, s.group as state_group,
           p.name as project_name, p.identifier as project_identifier,
           COALESCE(
             (SELECT string_agg(u.first_name, ', ')
              FROM issue_assignees ia JOIN users u ON ia.assignee_id = u.id
              WHERE ia.issue_id = i.id AND ia.deleted_at IS NULL),
             'unassigned'
           ) as assignees,
           COALESCE(
             (SELECT string_agg(l.name, ', ')
              FROM issue_labels il JOIN labels l ON il.label_id = l.id
              WHERE il.issue_id = i.id AND il.deleted_at IS NULL),
             ''
           ) as labels
    FROM issues i
    JOIN states s ON i.state_id = s.id
    JOIN projects p ON i.project_id = p.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE i.priority
        WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2
        WHEN 'low' THEN 3 ELSE 4
      END,
      i.sort_order
    LIMIT ${limit}
  `;

  const rows = await query(sql, params);
  if (rows.length === 0) return 'No issues found.';

  const lines = rows.map((r: any) => {
    const priority = r.priority === 'none' ? '' : `[${r.priority.toUpperCase()}] `;
    const due = r.target_date ? ` | Due: ${r.target_date}` : '';
    const lbls = r.labels ? ` | ${r.labels}` : '';
    return `${priority}${r.project_identifier}-${r.sequence_id}: ${r.name} | ${r.assignees}${due} | ${r.state_name}${lbls}`;
  });
  return lines.join('\n');
}

export async function getIssue(issueId: string): Promise<string> {
  const rows = await query(
    `SELECT i.*,
            s.name as state_name, s.group as state_group,
            p.name as project_name, p.identifier as project_identifier,
            COALESCE(
              (SELECT string_agg(u.first_name || ' (' || u.email || ')', ', ')
               FROM issue_assignees ia JOIN users u ON ia.assignee_id = u.id
               WHERE ia.issue_id = i.id AND ia.deleted_at IS NULL),
              'unassigned'
            ) as assignees,
            COALESCE(
              (SELECT string_agg(l.name, ', ')
               FROM issue_labels il JOIN labels l ON il.label_id = l.id
               WHERE il.issue_id = i.id AND il.deleted_at IS NULL),
              ''
            ) as labels
     FROM issues i
     JOIN states s ON i.state_id = s.id
     JOIN projects p ON i.project_id = p.id
     WHERE i.id = $1 AND i.deleted_at IS NULL`,
    [issueId],
  );

  if (rows.length === 0) return 'Issue not found.';

  const r = rows[0];
  const lines = [
    `# ${r.project_identifier}-${r.sequence_id}: ${r.name}`,
    `Priority: ${r.priority} | State: ${r.state_name} (${r.state_group})`,
    `Assignees: ${r.assignees}`,
    `Project: ${r.project_name}`,
  ];
  if (r.labels) lines.push(`Labels: ${r.labels}`);
  if (r.start_date) lines.push(`Start: ${r.start_date}`);
  if (r.target_date) lines.push(`Due: ${r.target_date}`);
  if (r.completed_at) lines.push(`Completed: ${r.completed_at}`);
  if (r.description_stripped) lines.push(`\nDescription:\n${r.description_stripped}`);

  return lines.join('\n');
}

export async function createIssue(opts: {
  project: string;
  name: string;
  priority?: string;
  state?: string;
  assignee?: string;
  description?: string;
  target_date?: string;
  start_date?: string;
}): Promise<string> {
  const wsId = await getWorkspaceId();

  // Resolve project by identifier or name
  const projects = await query(
    `SELECT id, identifier FROM projects
     WHERE workspace_id = $1 AND deleted_at IS NULL
     AND (identifier = $2 OR name ILIKE $2)`,
    [wsId, opts.project],
  );
  if (projects.length === 0) throw new Error(`Project '${opts.project}' not found`);
  const projectId = projects[0].id;
  const projectIdentifier = projects[0].identifier;

  // Get the next sequence number (use advisory lock to prevent race conditions)
  await execute(`SELECT pg_advisory_lock(hashtext($1::text))`, [projectId]);
  const seqRows = await query(
    `SELECT COALESCE(MAX(sequence_id), 0) + 1 as next_seq FROM issues WHERE project_id = $1`,
    [projectId],
  );
  const nextSeq = seqRows[0].next_seq;

  // Resolve state (default to first 'unstarted' state)
  let stateId: string;
  if (opts.state) {
    const states = await query(
      `SELECT id FROM states WHERE project_id = $1 AND deleted_at IS NULL
       AND (name ILIKE $2 OR "group" = $2) ORDER BY sequence LIMIT 1`,
      [projectId, opts.state],
    );
    if (states.length === 0) throw new Error(`State '${opts.state}' not found`);
    stateId = states[0].id;
  } else {
    const states = await query(
      `SELECT id FROM states WHERE project_id = $1 AND deleted_at IS NULL
       AND "group" = 'unstarted' ORDER BY sequence LIMIT 1`,
      [projectId],
    );
    if (states.length === 0) {
      // Fallback to any non-completed state
      const fallback = await query(
        `SELECT id FROM states WHERE project_id = $1 AND deleted_at IS NULL
         ORDER BY sequence LIMIT 1`,
        [projectId],
      );
      if (fallback.length === 0) throw new Error('No states found for project');
      stateId = fallback[0].id;
    } else {
      stateId = states[0].id;
    }
  }

  const issueId = randomUUID();
  const now = new Date().toISOString();

  const descText = opts.description || '';
  // description is JSONB (Plane's rich text), description_html is the rendered HTML
  const descJson = descText ? JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: descText }] }] }) : '{}';
  const descHtml = descText ? `<p>${descText}</p>` : '';

  await execute(
    `INSERT INTO issues (id, name, description, description_html, description_stripped, priority, state_id,
       project_id, workspace_id, sequence_id, sort_order, is_draft, created_at, updated_at,
       start_date, target_date)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, false, $12, $12, $13, $14)`,
    [
      issueId,
      opts.name,
      descJson,
      descHtml,
      descText,
      opts.priority || 'none',
      stateId,
      projectId,
      wsId,
      nextSeq,
      nextSeq * 65536, // sort_order
      now,
      opts.start_date || null,
      opts.target_date || null,
    ],
  );

  // Handle assignee if provided
  if (opts.assignee) {
    const users = await query(
      `SELECT id FROM users WHERE first_name ILIKE $1 OR email ILIKE $1 LIMIT 1`,
      [`%${opts.assignee}%`],
    );
    if (users.length > 0) {
      await execute(
        `INSERT INTO issue_assignees (id, issue_id, assignee_id, project_id, workspace_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [randomUUID(), issueId, users[0].id, projectId, wsId, now],
      );
    }
  }

  // Record in issue_sequences (maps issue to its sequence number)
  await execute(
    `INSERT INTO issue_sequences (id, issue_id, project_id, workspace_id, sequence, deleted, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, false, $6, $6)`,
    [randomUUID(), issueId, projectId, wsId, nextSeq, now],
  );

  // Release advisory lock
  await execute(`SELECT pg_advisory_unlock(hashtext($1::text))`, [projectId]);

  return `Created ${projectIdentifier}-${nextSeq}: ${opts.name} (id: ${issueId})`;
}

export async function updateIssue(
  issueId: string,
  updates: {
    name?: string;
    priority?: string;
    state?: string;
    assignee?: string;
    target_date?: string;
    start_date?: string;
  },
): Promise<string> {
  const now = new Date().toISOString();
  const setClauses: string[] = [`updated_at = $2`];
  const params: any[] = [issueId, now];
  let paramIdx = 3;

  if (updates.name) {
    setClauses.push(`name = $${paramIdx}`);
    params.push(updates.name);
    paramIdx++;
  }

  if (updates.priority) {
    setClauses.push(`priority = $${paramIdx}`);
    params.push(updates.priority);
    paramIdx++;
  }

  if (updates.target_date !== undefined) {
    setClauses.push(`target_date = $${paramIdx}`);
    params.push(updates.target_date || null);
    paramIdx++;
  }

  if (updates.start_date !== undefined) {
    setClauses.push(`start_date = $${paramIdx}`);
    params.push(updates.start_date || null);
    paramIdx++;
  }

  if (updates.state) {
    // Resolve state by name or group
    const issue = await query(`SELECT project_id FROM issues WHERE id = $1`, [issueId]);
    if (issue.length === 0) return 'Issue not found.';

    const states = await query(
      `SELECT id, "group" FROM states WHERE project_id = $1 AND deleted_at IS NULL
       AND (name ILIKE $2 OR "group" = $2) ORDER BY sequence LIMIT 1`,
      [issue[0].project_id, updates.state],
    );
    if (states.length > 0) {
      setClauses.push(`state_id = $${paramIdx}`);
      params.push(states[0].id);
      paramIdx++;

      // Set completed_at if moving to completed group
      if (states[0].group === 'completed') {
        setClauses.push(`completed_at = $${paramIdx}`);
        params.push(now);
        paramIdx++;
      }
    }
  }

  const result = await execute(
    `UPDATE issues SET ${setClauses.join(', ')} WHERE id = $1 AND deleted_at IS NULL`,
    params,
  );

  // Handle assignee change
  if (updates.assignee !== undefined) {
    const issue = await query(`SELECT project_id, workspace_id FROM issues WHERE id = $1`, [issueId]);
    if (issue.length > 0) {
      // Remove existing assignees
      await execute(
        `UPDATE issue_assignees SET deleted_at = $2 WHERE issue_id = $1 AND deleted_at IS NULL`,
        [issueId, now],
      );

      if (updates.assignee) {
        const users = await query(
          `SELECT id FROM users WHERE first_name ILIKE $1 OR email ILIKE $1 LIMIT 1`,
          [`%${updates.assignee}%`],
        );
        if (users.length > 0) {
          await execute(
            `INSERT INTO issue_assignees (id, issue_id, assignee_id, project_id, workspace_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $6)`,
            [randomUUID(), issueId, users[0].id, issue[0].project_id, issue[0].workspace_id, now],
          );
        }
      }
    }
  }

  return result;
}

export async function completeIssue(issueIds: string[]): Promise<string> {
  const now = new Date().toISOString();
  const results: string[] = [];

  for (const issueId of issueIds) {
    // Get the issue's project to find the completed state
    const issue = await query(
      `SELECT i.id, i.name, i.project_id, p.identifier, i.sequence_id
       FROM issues i JOIN projects p ON i.project_id = p.id
       WHERE i.id = $1 AND i.deleted_at IS NULL`,
      [issueId],
    );
    if (issue.length === 0) {
      results.push(`${issueId}: not found`);
      continue;
    }

    // Find the completed state for this project
    const states = await query(
      `SELECT id FROM states WHERE project_id = $1 AND deleted_at IS NULL
       AND "group" = 'completed' ORDER BY sequence LIMIT 1`,
      [issue[0].project_id],
    );
    if (states.length === 0) {
      results.push(`${issue[0].identifier}-${issue[0].sequence_id}: no completed state found`);
      continue;
    }

    await execute(
      `UPDATE issues SET state_id = $2, completed_at = $3, updated_at = $3
       WHERE id = $1 AND deleted_at IS NULL`,
      [issueId, states[0].id, now],
    );

    results.push(`${issue[0].identifier}-${issue[0].sequence_id}: ${issue[0].name} -> completed`);
  }

  return results.join('\n');
}

export async function searchIssues(searchText: string, limit?: number): Promise<string> {
  const wsId = await getWorkspaceId();
  const maxResults = limit || 20;

  const rows = await query(
    `SELECT i.id, i.name, i.priority, i.sequence_id,
            i.target_date, i.completed_at,
            s.name as state_name, s.group as state_group,
            p.name as project_name, p.identifier as project_identifier,
            COALESCE(
              (SELECT string_agg(u.first_name, ', ')
               FROM issue_assignees ia JOIN users u ON ia.assignee_id = u.id
               WHERE ia.issue_id = i.id AND ia.deleted_at IS NULL),
              'unassigned'
            ) as assignees
     FROM issues i
     JOIN states s ON i.state_id = s.id
     JOIN projects p ON i.project_id = p.id
     WHERE i.workspace_id = $1 AND i.deleted_at IS NULL
     AND (i.name ILIKE $2 OR i.description_stripped ILIKE $2)
     ORDER BY
       CASE WHEN i.name ILIKE $2 THEN 0 ELSE 1 END,
       i.updated_at DESC
     LIMIT $3`,
    [wsId, `%${searchText}%`, maxResults],
  );

  if (rows.length === 0) return `No issues matching '${searchText}'.`;

  const lines = rows.map((r: any) => {
    const priority = r.priority === 'none' ? '' : `[${r.priority.toUpperCase()}] `;
    const due = r.target_date ? ` | Due: ${r.target_date}` : '';
    return `${priority}${r.project_identifier}-${r.sequence_id}: ${r.name} | ${r.assignees}${due} | ${r.state_name}`;
  });
  return lines.join('\n');
}

export async function rawQuery(sql: string): Promise<string> {
  // Only allow SELECT and WITH statements for safety
  const trimmed = sql.trim().toUpperCase();
  const isRead = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('EXPLAIN');

  if (!isRead) {
    return 'Error: query tool only supports SELECT/WITH/EXPLAIN statements. Use create_issue, update_issue, or complete_issue for mutations.';
  }

  const rows = await query(sql);

  if (rows.length === 0) return 'No results.';

  // Format as table
  const columns = Object.keys(rows[0]);
  const header = columns.join(' | ');
  const separator = columns.map((c) => '-'.repeat(c.length)).join('-+-');
  const dataRows = rows.map((r: any) =>
    columns.map((c) => {
      const val = r[c];
      if (val === null) return 'NULL';
      if (val instanceof Date) return val.toISOString();
      return String(val);
    }).join(' | '),
  );

  return [header, separator, ...dataRows].join('\n');
}
