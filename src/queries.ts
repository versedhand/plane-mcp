import { query, execute, getWorkspaceSlug, getAvailableInstances, getLifedbPool } from './db.js';
import type { InstanceName } from './db.js';
import { randomUUID } from 'crypto';

// Cache workspace IDs per instance
const workspaceIds = new Map<InstanceName, string>();

async function getWorkspaceId(instance: InstanceName = 'personal'): Promise<string> {
  if (workspaceIds.has(instance)) return workspaceIds.get(instance)!;
  const slug = getWorkspaceSlug(instance);
  const rows = await query(
    `SELECT id FROM workspaces WHERE slug = $1 AND deleted_at IS NULL`,
    [slug],
    instance,
  );
  if (rows.length === 0) throw new Error(`Workspace '${slug}' not found on ${instance} instance`);
  workspaceIds.set(instance, rows[0].id as string);
  return workspaceIds.get(instance)!;
}

export async function listProjects(instance: InstanceName = 'personal'): Promise<string> {
  const wsId = await getWorkspaceId(instance);
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
    instance,
  );

  if (rows.length === 0) return `No projects found on ${instance} instance.`;

  const lines = rows.map(
    (r: any) => `${r.identifier} | ${r.name} | ${r.open_count}/${r.issue_count} open | id: ${r.id}`,
  );
  return `[${instance}]\n` + lines.join('\n');
}

export async function listIssues(opts: {
  project?: string;
  state?: string;
  assignee?: string;
  priority?: string;
  label?: string;
  limit?: number;
  instance?: InstanceName;
}): Promise<string> {
  const inst = opts.instance || 'personal';
  const wsId = await getWorkspaceId(inst);
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

  const rows = await query(sql, params, inst);
  if (rows.length === 0) return 'No issues found.';

  const lines = rows.map((r: any) => {
    const priority = r.priority === 'none' ? '' : `[${r.priority.toUpperCase()}] `;
    const due = r.target_date ? ` | Due: ${r.target_date}` : '';
    const lbls = r.labels ? ` | ${r.labels}` : '';
    return `${priority}${r.project_identifier}-${r.sequence_id}: ${r.name} | ${r.assignees}${due} | ${r.state_name}${lbls}`;
  });
  return lines.join('\n');
}

export async function getIssue(issueId: string, instance: InstanceName = 'personal'): Promise<string> {
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
    instance,
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
  labels?: string[];
  instance?: InstanceName;
}): Promise<string> {
  const inst = opts.instance || 'personal';
  const wsId = await getWorkspaceId(inst);

  // Resolve project (supports UUID, identifier, or name)
  const projects = await query(
    `SELECT id, identifier FROM projects
     WHERE workspace_id = $1 AND deleted_at IS NULL
     AND (id::text = $2 OR identifier = $2 OR name ILIKE $2)`,
    [wsId, opts.project],
    inst,
  );
  if (projects.length === 0) throw new Error(`Project '${opts.project}' not found`);
  const projectId = projects[0].id;
  const projectIdentifier = projects[0].identifier;

  // Advisory lock + sequence
  await execute(`SELECT pg_advisory_lock(hashtext($1::text))`, [projectId], inst);
  const seqRows = await query(
    `SELECT COALESCE(MAX(sequence_id), 0) + 1 as next_seq FROM issues WHERE project_id = $1`,
    [projectId],
    inst,
  );
  const nextSeq = seqRows[0].next_seq;

  // Resolve state
  let stateId: string;
  if (opts.state) {
    const states = await query(
      `SELECT id FROM states WHERE project_id = $1 AND deleted_at IS NULL
       AND (name ILIKE $2 OR "group" = $2) ORDER BY sequence LIMIT 1`,
      [projectId, opts.state],
      inst,
    );
    if (states.length === 0) throw new Error(`State '${opts.state}' not found`);
    stateId = states[0].id;
  } else {
    const states = await query(
      `SELECT id FROM states WHERE project_id = $1 AND deleted_at IS NULL
       AND "group" = 'unstarted' ORDER BY sequence LIMIT 1`,
      [projectId],
      inst,
    );
    if (states.length === 0) {
      const fallback = await query(
        `SELECT id FROM states WHERE project_id = $1 AND deleted_at IS NULL
         ORDER BY sequence LIMIT 1`,
        [projectId],
        inst,
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
  const descJson = descText
    ? JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: descText }] }] })
    : '{}';
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
      nextSeq * 65536,
      now,
      opts.start_date || null,
      opts.target_date || null,
    ],
    inst,
  );

  // Handle assignee
  if (opts.assignee) {
    const users = await query(
      `SELECT id FROM users WHERE first_name ILIKE $1 OR email ILIKE $1 LIMIT 1`,
      [`%${opts.assignee}%`],
      inst,
    );
    if (users.length > 0) {
      await execute(
        `INSERT INTO issue_assignees (id, issue_id, assignee_id, project_id, workspace_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [randomUUID(), issueId, users[0].id, projectId, wsId, now],
        inst,
      );
    }
  }

  // Handle labels
  if (opts.labels && opts.labels.length > 0) {
    for (const labelName of opts.labels) {
      const lblRows = await query(
        `SELECT id FROM labels WHERE workspace_id = $1 AND name ILIKE $2 AND deleted_at IS NULL LIMIT 1`,
        [wsId, labelName],
        inst,
      );
      if (lblRows.length > 0) {
        await execute(
          `INSERT INTO issue_labels (id, issue_id, label_id, project_id, workspace_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6)`,
          [randomUUID(), issueId, lblRows[0].id, projectId, wsId, now],
          inst,
        );
      }
    }
  }

  // Issue sequence record
  await execute(
    `INSERT INTO issue_sequences (id, issue_id, project_id, workspace_id, sequence, deleted, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, false, $6, $6)`,
    [randomUUID(), issueId, projectId, wsId, nextSeq, now],
    inst,
  );

  await execute(`SELECT pg_advisory_unlock(hashtext($1::text))`, [projectId], inst);

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
  instance: InstanceName = 'personal',
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
    const issue = await query(`SELECT project_id FROM issues WHERE id = $1`, [issueId], instance);
    if (issue.length === 0) return 'Issue not found.';

    const states = await query(
      `SELECT id, "group" FROM states WHERE project_id = $1 AND deleted_at IS NULL
       AND (name ILIKE $2 OR "group" = $2) ORDER BY sequence LIMIT 1`,
      [issue[0].project_id, updates.state],
      instance,
    );
    if (states.length > 0) {
      setClauses.push(`state_id = $${paramIdx}`);
      params.push(states[0].id);
      paramIdx++;

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
    instance,
  );

  if (updates.assignee !== undefined) {
    const issue = await query(`SELECT project_id, workspace_id FROM issues WHERE id = $1`, [issueId], instance);
    if (issue.length > 0) {
      await execute(
        `UPDATE issue_assignees SET deleted_at = $2 WHERE issue_id = $1 AND deleted_at IS NULL`,
        [issueId, now],
        instance,
      );

      if (updates.assignee) {
        const users = await query(
          `SELECT id FROM users WHERE first_name ILIKE $1 OR email ILIKE $1 LIMIT 1`,
          [`%${updates.assignee}%`],
          instance,
        );
        if (users.length > 0) {
          await execute(
            `INSERT INTO issue_assignees (id, issue_id, assignee_id, project_id, workspace_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $6)`,
            [randomUUID(), issueId, users[0].id, issue[0].project_id, issue[0].workspace_id, now],
            instance,
          );
        }
      }
    }
  }

  return result;
}

export async function completeIssue(issueIds: string[], instance: InstanceName = 'personal'): Promise<string> {
  const now = new Date().toISOString();
  const results: string[] = [];

  for (const issueId of issueIds) {
    const issue = await query(
      `SELECT i.id, i.name, i.project_id, p.identifier, i.sequence_id
       FROM issues i JOIN projects p ON i.project_id = p.id
       WHERE i.id = $1 AND i.deleted_at IS NULL`,
      [issueId],
      instance,
    );
    if (issue.length === 0) {
      results.push(`${issueId}: not found`);
      continue;
    }

    const states = await query(
      `SELECT id FROM states WHERE project_id = $1 AND deleted_at IS NULL
       AND "group" = 'completed' ORDER BY sequence LIMIT 1`,
      [issue[0].project_id],
      instance,
    );
    if (states.length === 0) {
      results.push(`${issue[0].identifier}-${issue[0].sequence_id}: no completed state found`);
      continue;
    }

    await execute(
      `UPDATE issues SET state_id = $2, completed_at = $3, updated_at = $3
       WHERE id = $1 AND deleted_at IS NULL`,
      [issueId, states[0].id, now],
      instance,
    );

    results.push(`${issue[0].identifier}-${issue[0].sequence_id}: ${issue[0].name} -> completed`);

    // Check for recurrence rule in LifeDB
    try {
      const recurrenceResult = await processRecurrenceIfExists(issueId, instance);
      if (recurrenceResult) {
        results.push(`  ↳ Recurrence: ${recurrenceResult}`);
      }
    } catch (err: any) {
      results.push(`  ↳ Recurrence error: ${err.message}`);
    }
  }

  return results.join('\n');
}

// --- Recurrence Engine ---

interface RecurrenceRule {
  id: number;
  plane_instance: InstanceName;
  plane_issue_id: string;
  plane_project_id: string;
  recur_type: string;
  recur_interval_days: number | null;
  recur_weekdays: number[] | null;
  recur_monthday: number | null;
  exercise_last_type: string | null;
  exercise_streak: number;
  template_name: string;
  template_priority: string;
  template_labels: string[];
  template_description: string | null;
  enabled: boolean;
}

async function processRecurrenceIfExists(issueId: string, instance: InstanceName): Promise<string | null> {
  const lifedb = getLifedbPool();
  try {
    const rows = await lifedb.query(
      `SELECT * FROM plane_recurrence WHERE plane_issue_id = $1 AND enabled = true`,
      [issueId],
    );
    if (rows.rows.length === 0) return null;

    const rule = rows.rows[0] as RecurrenceRule;
    return processRecurrence(rule);
  } catch (err: any) {
    // Table may not exist yet (created on-demand when first recurrence rule is added)
    if (err.message?.includes('does not exist')) {
      return null;
    }
    throw err;
  }
}

async function processRecurrence(rule: RecurrenceRule): Promise<string> {
  if (rule.recur_type === 'exercise_cycle') {
    return handleExerciseCycle(rule);
  }

  // Get the current issue's target_date to calculate next due
  const currentIssue = await query(
    `SELECT target_date FROM issues WHERE id = $1`,
    [rule.plane_issue_id],
    rule.plane_instance,
  );
  const currentDue = currentIssue.length > 0 && currentIssue[0].target_date
    ? new Date(currentIssue[0].target_date)
    : new Date();

  const nextDue = calculateNextDue(rule, currentDue);
  const nextDateStr = formatDate(nextDue);

  // Create new issue in Plane
  const result = await createIssue({
    project: rule.plane_project_id,
    name: rule.template_name,
    priority: rule.template_priority,
    description: rule.template_description || undefined,
    target_date: nextDateStr,
    instance: rule.plane_instance,
  });

  // Extract new issue ID from result
  const idMatch = result.match(/id: ([0-9a-f-]+)/);
  if (idMatch) {
    const lifedb = getLifedbPool();
    await lifedb.query(
      `UPDATE plane_recurrence SET plane_issue_id = $1, updated_at = NOW() WHERE id = $2`,
      [idMatch[1], rule.id],
    );
  }

  return `Next: ${rule.template_name} due ${nextDateStr}`;
}

async function handleExerciseCycle(rule: RecurrenceRule): Promise<string> {
  const nextType = rule.exercise_last_type === 'Push' ? 'Pull' : 'Push';

  // Check if exercise was completed yesterday (streak detection)
  const lifedb = getLifedbPool();
  const yesterdayCheck = await query(
    `SELECT COUNT(*) as cnt FROM issues i
     JOIN states s ON i.state_id = s.id
     WHERE i.project_id = $1 AND i.deleted_at IS NULL
     AND s.group = 'completed'
     AND i.completed_at::date = CURRENT_DATE - 1
     AND i.name LIKE 'Exercise%'`,
    [rule.plane_project_id],
    rule.plane_instance,
  );
  const hadYesterday = parseInt(yesterdayCheck[0]?.cnt || '0') > 0;

  // Day 2+ of streak: rest day, due in 2 days. Day 1 or gap: due tomorrow.
  const daysUntilNext = hadYesterday ? 2 : 1;
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + daysUntilNext);
  const nextDateStr = formatDate(nextDue);

  const newName = `Exercise — ${nextType}`;
  const result = await createIssue({
    project: rule.plane_project_id,
    name: newName,
    priority: rule.template_priority,
    description: rule.template_description || undefined,
    target_date: nextDateStr,
    instance: rule.plane_instance,
  });

  const idMatch = result.match(/id: ([0-9a-f-]+)/);
  if (idMatch) {
    await lifedb.query(
      `UPDATE plane_recurrence
       SET plane_issue_id = $1, exercise_last_type = $2,
           exercise_streak = CASE WHEN $3 THEN exercise_streak + 1 ELSE 1 END,
           updated_at = NOW()
       WHERE id = $4`,
      [idMatch[1], nextType, hadYesterday, rule.id],
    );
  }

  const restNote = hadYesterday ? ' (rest day earned)' : '';
  return `Next: ${newName} due ${nextDateStr}${restNote}`;
}

function calculateNextDue(rule: RecurrenceRule, currentDue: Date): Date {
  const next = new Date(currentDue);
  switch (rule.recur_type) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'interval':
      next.setDate(next.getDate() + (rule.recur_interval_days || 7));
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  return next;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

// --- Tasks Due (cross-instance) ---

export async function tasksDue(instance?: InstanceName | 'all'): Promise<string> {
  const instances = instance === 'all' || !instance
    ? getAvailableInstances()
    : [instance as InstanceName];

  const allLines: string[] = [];

  for (const inst of instances) {
    try {
      const wsId = await getWorkspaceId(inst);
      const rows = await query(
        `SELECT i.id, i.name, i.priority, i.sequence_id,
                i.target_date,
                s.name as state_name,
                p.identifier as project_identifier
         FROM issues i
         JOIN states s ON i.state_id = s.id
         JOIN projects p ON i.project_id = p.id
         WHERE i.workspace_id = $1
           AND i.deleted_at IS NULL AND i.archived_at IS NULL
           AND s.group NOT IN ('completed', 'cancelled')
           AND i.target_date <= CURRENT_DATE
         ORDER BY
           i.target_date,
           CASE i.priority
             WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2
             WHEN 'low' THEN 3 ELSE 4
           END`,
        [wsId],
        inst,
      );

      for (const r of rows) {
        const priority = r.priority === 'none' ? '' : `[${r.priority.toUpperCase()}] `;
        const overdue = r.target_date < new Date().toISOString().split('T')[0] ? ' OVERDUE' : '';
        allLines.push(`${priority}${r.project_identifier}-${r.sequence_id}: ${r.name} | Due: ${r.target_date}${overdue} | ${r.state_name} [${inst}]`);
      }
    } catch {
      // Instance might not be configured; skip
    }
  }

  if (allLines.length === 0) return 'No tasks due today or overdue.';
  return `${allLines.length} tasks due/overdue:\n` + allLines.join('\n');
}

export async function searchIssues(searchText: string, limit?: number, instance: InstanceName = 'personal'): Promise<string> {
  const wsId = await getWorkspaceId(instance);
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
    instance,
  );

  if (rows.length === 0) return `No issues matching '${searchText}'.`;

  const lines = rows.map((r: any) => {
    const priority = r.priority === 'none' ? '' : `[${r.priority.toUpperCase()}] `;
    const due = r.target_date ? ` | Due: ${r.target_date}` : '';
    return `${priority}${r.project_identifier}-${r.sequence_id}: ${r.name} | ${r.assignees}${due} | ${r.state_name}`;
  });
  return lines.join('\n');
}

export async function rawQuery(sql: string, instance: InstanceName = 'personal'): Promise<string> {
  const trimmed = sql.trim().toUpperCase();
  const isRead = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('EXPLAIN');

  if (!isRead) {
    return 'Error: query tool only supports SELECT/WITH/EXPLAIN statements. Use create_issue, update_issue, or complete_issue for mutations.';
  }

  const rows = await query(sql, undefined, instance);

  if (rows.length === 0) return 'No results.';

  const columns = Object.keys(rows[0]);
  const header = columns.join(' | ');
  const separator = columns.map((c) => '-'.repeat(c.length)).join('-+-');
  const dataRows = rows.map((r: any) =>
    columns
      .map((c) => {
        const val = r[c];
        if (val === null) return 'NULL';
        if (val instanceof Date) return val.toISOString();
        return String(val);
      })
      .join(' | '),
  );

  return [header, separator, ...dataRows].join('\n');
}
