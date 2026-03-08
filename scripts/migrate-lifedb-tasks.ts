#!/usr/bin/env npx tsx
/**
 * Migrate active tasks from LifeDB tasks table to Plane CE.
 *
 * Usage:
 *   npx tsx scripts/migrate-lifedb-tasks.ts --dry-run   # Preview
 *   npx tsx scripts/migrate-lifedb-tasks.ts              # Execute
 *
 * Requires env vars: PLANE_PERSONAL_*, PLANE_NTS_*, LIFEDB_URL
 */

import pg from 'pg';
const { Pool } = pg;

// ── Config ──────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');

interface PlaneTarget {
  instance: 'personal' | 'nts';
  projectId: string;
  workspaceId: string;
  userId: string;
  todoStateId: string;
}

// Personal instance
const PERSONAL_WS = 'd712529a-fe65-4baa-82f0-92df61529c88';
const PERSONAL_USER = '2a59c5d1-4e0b-46e5-bb75-8aa58170db01';

// NTS instance
const NTS_WS = '3824eb4a-fd44-450d-a901-575de9f6b583';
const NTS_USER = '292b65ae-9940-4f33-86c1-b94cb04c28be';

// Project mapping: LifeDB project_id → Plane target
const PROJECT_MAP: Record<string, { instance: 'personal' | 'nts'; projectId: string; todoStateId: string }> = {
  // Personal instance
  'health':                   { instance: 'personal', projectId: '877d4ce6-ad06-48c3-960d-fb99d34ad4de', todoStateId: 'fc9c0d81-8367-4902-8eef-c308812a65d6' },
  'inbox':                    { instance: 'personal', projectId: 'a20517b0-9079-4931-a193-fb1c1ff27b9e', todoStateId: 'ee1ceccf-351e-4252-a258-9d0e4395f16f' },
  'iadl':                     { instance: 'personal', projectId: 'a20517b0-9079-4931-a193-fb1c1ff27b9e', todoStateId: 'ee1ceccf-351e-4252-a258-9d0e4395f16f' },
  'finances':                 { instance: 'personal', projectId: 'd2661a94-82bc-4df5-a073-e9fe2f12115b', todoStateId: 'd1326b86-3337-4294-885f-2d86cb0452a3' },
  'credit-repair':            { instance: 'personal', projectId: 'd2661a94-82bc-4df5-a073-e9fe2f12115b', todoStateId: 'd1326b86-3337-4294-885f-2d86cb0452a3' },
  'nashville-move':           { instance: 'personal', projectId: '2d9308f4-559f-4b5a-bca2-c913b631444c', todoStateId: '6643a861-b5ee-4d3f-849e-583d19b66cfb' },
  'nashville':                { instance: 'personal', projectId: '2d9308f4-559f-4b5a-bca2-c913b631444c', todoStateId: '6643a861-b5ee-4d3f-849e-583d19b66cfb' },
  'move':                     { instance: 'personal', projectId: '2d9308f4-559f-4b5a-bca2-c913b631444c', todoStateId: '6643a861-b5ee-4d3f-849e-583d19b66cfb' },
  'psychiatrist-transition':  { instance: 'personal', projectId: '2d9308f4-559f-4b5a-bca2-c913b631444c', todoStateId: '6643a861-b5ee-4d3f-849e-583d19b66cfb' },
  'infra':                    { instance: 'personal', projectId: 'e071d3f2-d07f-4601-9a36-591b20b6b59d', todoStateId: '7656efd7-e475-4db6-b743-be8a6c20a715' },
  'infrastructure':           { instance: 'personal', projectId: 'e071d3f2-d07f-4601-9a36-591b20b6b59d', todoStateId: '7656efd7-e475-4db6-b743-be8a6c20a715' },
  'llm-infrastructure':       { instance: 'personal', projectId: 'e071d3f2-d07f-4601-9a36-591b20b6b59d', todoStateId: '7656efd7-e475-4db6-b743-be8a6c20a715' },
  'social':                   { instance: 'personal', projectId: 'f3925faa-f2a7-41ab-8bd4-ffc644150de9', todoStateId: '096d4db1-4762-4f96-b300-ce6791050449' },
  'watch-setup':              { instance: 'personal', projectId: 'ddeea96e-a0c9-4f5e-a6b3-43adacae8031', todoStateId: '96a300f9-6da3-4c93-8298-c627c0932459' },
  'watch-app':                { instance: 'personal', projectId: 'ddeea96e-a0c9-4f5e-a6b3-43adacae8031', todoStateId: '96a300f9-6da3-4c93-8298-c627c0932459' },
  'recordings':               { instance: 'personal', projectId: 'ddeea96e-a0c9-4f5e-a6b3-43adacae8031', todoStateId: '96a300f9-6da3-4c93-8298-c627c0932459' },
  'curiosity':                { instance: 'personal', projectId: 'ddeea96e-a0c9-4f5e-a6b3-43adacae8031', todoStateId: '96a300f9-6da3-4c93-8298-c627c0932459' },
  'nts-rebrand':              { instance: 'personal', projectId: 'ddeea96e-a0c9-4f5e-a6b3-43adacae8031', todoStateId: '96a300f9-6da3-4c93-8298-c627c0932459' },
  'bugs':                     { instance: 'personal', projectId: 'ddeea96e-a0c9-4f5e-a6b3-43adacae8031', todoStateId: '96a300f9-6da3-4c93-8298-c627c0932459' },

  // NTS instance
  'camelot':                  { instance: 'nts', projectId: '5bfa4948-7ea0-4377-bdbc-f6ec8a5e9c7e', todoStateId: 'be1566e2-84e8-4cc7-8033-aedaf7ddd942' },
  'nts':                      { instance: 'nts', projectId: '6ffd837b-1f2b-4cea-a4b5-c99f020152f3', todoStateId: '0fd1ad1a-03ea-4339-9109-d75b75b93bf4' },
  'nts-staffing':             { instance: 'nts', projectId: '6ffd837b-1f2b-4cea-a4b5-c99f020152f3', todoStateId: '0fd1ad1a-03ea-4339-9109-d75b75b93bf4' },
  'operatek':                 { instance: 'nts', projectId: '34882b32-f90d-4bc2-a4e2-5d0e64f684f8', todoStateId: '793f82bc-9899-43b3-8d6d-8db2cdd88fb4' },
  'employment':               { instance: 'nts', projectId: '194c377c-2dea-4b80-b169-1849881e64c5', todoStateId: '6d62ce68-0710-489c-b4b9-98a346dea7df' },
};

// Label IDs per instance
const LABELS: Record<string, Record<string, string>> = {
  personal: {
    'recurring':        '3b078463-7b7a-492e-beb4-7234647b3e3e',
    'tier-1':           'dcc556b7-0143-4285-897e-7bc86dc05337',
    'exercise':         '280327b6-c928-4e01-931a-79f791066e18',
    'autonomy:user':    '7d461bd9-59d3-4085-89a7-01034c6ccab3',
    'autonomy:confirm': '21cddffd-7faa-427d-bbbe-a3e53dfa574f',
    'autonomy:auto':    '3ed5a7a2-8d21-4154-9359-0027d93106f2',
  },
  nts: {
    'recurring':        '79457fcc-acf3-4154-856b-201bdbdb64f2',
    'tier-1':           '1c277978-c10a-4756-a70e-d06fe72058f8',
    'exercise':         'efc4b56a-2935-4d40-b12a-f4086e87ba9f',
    'autonomy:user':    '4f3eeb5b-ca88-4d0f-a191-c63a812c9b4a',
    'autonomy:confirm': '2f3367e9-513b-4bcf-bc46-f81808abbfb7',
    'autonomy:auto':    '273e64b6-2abc-4770-896f-49e065959e0d',
  },
};

// ── Priority mapping ────────────────────────────────────────────────

function mapPriority(p: string): string {
  switch (p) {
    case 'urgent': return 'urgent';
    case 'high': return 'high';
    case 'medium': return 'medium';
    case 'low': return 'low';
    default: return 'none';
  }
}

// ── Autonomy → label ────────────────────────────────────────────────

function autonomyLabel(autonomy: string): string | null {
  switch (autonomy) {
    case 'user_only': return 'autonomy:user';
    case 'confirm_first': return 'autonomy:confirm';
    case 'agent_autonomous': return 'autonomy:auto';
    default: return null;
  }
}

// ── Resolve target ──────────────────────────────────────────────────

function resolveTarget(projectIds: string[]): { instance: 'personal' | 'nts'; projectId: string; todoStateId: string } {
  // Try first project_id
  for (const pid of projectIds) {
    if (PROJECT_MAP[pid]) return PROJECT_MAP[pid];
  }
  // Fallback: personal Daily Life
  console.warn(`  ⚠ Unknown project_ids: [${projectIds.join(', ')}] → defaulting to Daily Life`);
  return PROJECT_MAP['inbox'];
}

// ── Build description ───────────────────────────────────────────────

function buildDescription(task: any): string {
  const parts: string[] = [];
  if (task.due_time) parts.push(`Due time: ${task.due_time}`);
  if (task.description) parts.push(task.description);
  if (task.corpus_ref) parts.push(`Corpus ref: ${task.corpus_ref}`);
  parts.push(`\nMigrated from LifeDB task: ${task.id}`);
  return parts.join('\n\n');
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE MIGRATION ===');

  // Connect to LifeDB
  const lifedb = new Pool({
    connectionString: process.env.LIFEDB_URL || 'postgresql://postgres@100.127.104.75:5432/lifedb',
    max: 3,
  });

  // Connect to Plane instances
  const planePools: Record<string, Pool> = {
    personal: new Pool({
      host: process.env.PLANE_PERSONAL_DB_HOST || '100.98.237.4',
      port: parseInt(process.env.PLANE_PERSONAL_DB_PORT || '15432'),
      user: process.env.PLANE_PERSONAL_DB_USER || 'plane_mcp',
      password: process.env.PLANE_PERSONAL_DB_PASSWORD || 'PlaneMcp2026rr',
      database: process.env.PLANE_PERSONAL_DB_NAME || 'plane',
      max: 5,
    }),
    nts: new Pool({
      host: process.env.PLANE_NTS_DB_HOST || '100.98.237.4',
      port: parseInt(process.env.PLANE_NTS_DB_PORT || '15433'),
      user: process.env.PLANE_NTS_DB_USER || 'plane_mcp',
      password: process.env.PLANE_NTS_DB_PASSWORD || 'PlaneMcp2026rr',
      database: process.env.PLANE_NTS_DB_NAME || 'plane',
      max: 5,
    }),
  };

  // Get sequence counters
  const seqCounters: Record<string, number> = {};
  for (const inst of ['personal', 'nts']) {
    const r = await planePools[inst].query('SELECT COALESCE(MAX(sequence_id), 0) as max FROM issues');
    seqCounters[inst] = r.rows[0].max;
  }

  // Fetch all active tasks
  const { rows: tasks } = await lifedb.query(`
    SELECT id, name, description, priority, due_date, due_time,
      autonomy, recur_type, recur_interval_days, recur_weekdays, recur_monthday,
      project_ids, corpus_ref
    FROM tasks
    WHERE status = 'active'
    ORDER BY due_date, priority
  `);

  console.log(`Found ${tasks.length} active tasks to migrate\n`);

  // Ensure migration map table exists
  if (!DRY_RUN) {
    await lifedb.query(`
      CREATE TABLE IF NOT EXISTS plane_migration_map (
        lifedb_task_id TEXT PRIMARY KEY,
        plane_instance TEXT NOT NULL,
        plane_issue_id UUID NOT NULL,
        plane_project_id UUID NOT NULL,
        migrated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  let created = 0;
  let recurrenceCreated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const task of tasks) {
    try {
      const target = resolveTarget(task.project_ids || ['inbox']);
      const wsId = target.instance === 'personal' ? PERSONAL_WS : NTS_WS;
      const userId = target.instance === 'personal' ? PERSONAL_USER : NTS_USER;
      const pool = planePools[target.instance];
      const labels = LABELS[target.instance];

      // Build issue fields
      const issueId = crypto.randomUUID();
      seqCounters[target.instance]++;
      const seqId = seqCounters[target.instance];
      const priority = mapPriority(task.priority);
      const desc = buildDescription(task);
      const targetDate = task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : null;

      // Determine labels to attach
      const issueLabels: string[] = [];
      const autoLabel = autonomyLabel(task.autonomy);
      if (autoLabel && labels[autoLabel]) issueLabels.push(labels[autoLabel]);
      if (task.recur_type) issueLabels.push(labels['recurring']);

      if (DRY_RUN) {
        console.log(`[${target.instance}] ${task.name}`);
        console.log(`  → project: ${target.projectId} | priority: ${priority} | due: ${targetDate}`);
        console.log(`  → labels: ${issueLabels.length > 0 ? issueLabels.join(', ') : 'none'}`);
        if (task.recur_type) console.log(`  → recurrence: ${task.recur_type} (interval: ${task.recur_interval_days || 'n/a'})`);
        console.log();
        created++;
        if (task.recur_type) recurrenceCreated++;
        continue;
      }

      // Insert issue
      await pool.query(`
        INSERT INTO issues (
          id, workspace_id, project_id, state_id,
          name, description, description_html, description_stripped,
          priority, target_date, sequence_id, sort_order,
          is_draft, created_by_id, updated_by_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, NOW(), NOW()
        )
      `, [
        issueId, wsId, target.projectId, target.todoStateId,
        task.name, '{}', `<p>${desc.replace(/\n/g, '<br/>')}</p>`, desc,
        priority, targetDate, seqId, 65535,
        false, userId, userId,
      ]);

      // Attach labels
      for (const labelId of issueLabels) {
        await pool.query(`
          INSERT INTO issue_labels (id, issue_id, label_id, project_id, workspace_id, created_by_id, updated_by_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `, [crypto.randomUUID(), issueId, labelId, target.projectId, wsId, userId, userId]);
      }

      // Create recurrence rule if recurring
      if (task.recur_type) {
        await lifedb.query(`
          INSERT INTO plane_recurrence (
            plane_instance, plane_issue_id, plane_project_id,
            recur_type, recur_interval_days, recur_weekdays, recur_monthday,
            template_name, template_priority, template_labels, template_description,
            enabled
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        `, [
          target.instance,
          issueId,
          target.projectId,
          task.recur_type === 'custom' ? 'interval' : task.recur_type,
          task.recur_interval_days,
          task.recur_weekdays,
          task.recur_monthday,
          task.name,
          priority,
          issueLabels.length > 0 ? issueLabels : null,
          desc,
        ]);
        recurrenceCreated++;
      }

      // Record migration mapping
      await lifedb.query(`
        INSERT INTO plane_migration_map (lifedb_task_id, plane_instance, plane_issue_id, plane_project_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (lifedb_task_id) DO NOTHING
      `, [task.id, target.instance, issueId, target.projectId]);

      created++;
      if (created % 20 === 0) console.log(`  ... ${created}/${tasks.length} migrated`);

    } catch (err: any) {
      errors.push(`${task.id}: ${err.message}`);
      console.error(`  ✗ ${task.id}: ${err.message}`);
    }
  }

  // Mark LifeDB tasks as migrated (only in live mode)
  if (!DRY_RUN && created > 0) {
    await lifedb.query(`
      UPDATE tasks SET status = 'migrated'
      WHERE status = 'active'
        AND id IN (SELECT lifedb_task_id FROM plane_migration_map)
    `);
    console.log(`\nMarked ${created} LifeDB tasks as 'migrated'`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Tasks migrated: ${created}`);
  console.log(`Recurrence rules: ${recurrenceCreated}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  ${e}`));
  }

  // Cleanup
  await lifedb.end();
  for (const p of Object.values(planePools)) await p.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
