/**
 * Integration tests for plane-mcp queries.
 * Requires live connections to both Plane instances and LifeDB.
 *
 * Run: PLANE_PERSONAL_DB_HOST=localhost PLANE_PERSONAL_DB_PORT=15432 \
 *      PLANE_PERSONAL_DB_PASSWORD=$PLANE_DB_PASSWORD PLANE_PERSONAL_WORKSPACE_SLUG=personal \
 *      PLANE_NTS_DB_HOST=localhost PLANE_NTS_DB_PORT=15433 \
 *      PLANE_NTS_DB_PASSWORD=$PLANE_DB_PASSWORD PLANE_NTS_WORKSPACE_SLUG=nts \
 *      LIFEDB_URL=postgresql://postgres@localhost:5432/lifedb \
 *      npx vitest run
 */

import { describe, it, expect, afterAll } from 'vitest';
import { listProjects, listIssues, getIssue, searchIssues, rawQuery, tasksDue, createIssue, completeIssue, updateIssue } from './queries.js';
import { shutdown, getPool, getLifedbPool } from './db.js';
import type { InstanceName } from './db.js';

// ⭐ CREDENTIAL GATE (added 2026-08-13). These are INTEGRATION tests: they open live
// connections to both Plane instances and CREATE REAL ISSUES ("Test issue — delete me").
// Without credentials every one of them threw `Plane instance 'personal' not configured`, so
// `npm test` reported 11 failed / 4 passed and had NEVER been green on a normal dev box.
//
// ⛔ WHY THAT MATTERED: a suite with permanent red cannot gate a change — nobody can tell a new
// regression from the standing failures, so everyone stops reading it. This package is published
// at 1.3.0 and is the live task interface for both Plane instances, and it has ALREADY shipped
// two silent-failure defects (an unknown label accepted and silently dropped; an empty
// target_date flipping an issue to Done). Those are exactly what a working suite catches.
//
// Skipping-with-a-reason is not hiding them: a skip is visibly distinct from a pass, whereas a
// permanent failure is visibly identical to a new one.
//
// To RUN them, supply the env in the header comment above and use:  npm run test:integration
const HAS_PLANE_CREDS =
  Boolean(process.env.PLANE_PERSONAL_DB_HOST || process.env.PLANE_DB_HOST) &&
  Boolean(process.env.PLANE_NTS_DB_HOST);

const describeLive = HAS_PLANE_CREDS ? describe : describe.skip;
// Per-test gate, for describes that mix live and pure-logic cases. `rawQuery`s
// DML-injection guard is pure logic on a PUBLISHED MCP and must never be skipped.
const itLive = HAS_PLANE_CREDS ? it : it.skip;

if (!HAS_PLANE_CREDS) {
  // Say it out loud. A silent skip and a suite with no tests look the same in CI output.
  console.warn(
    '[plane-mcp] SKIPPING live Plane integration tests — PLANE_PERSONAL_DB_HOST / ' +
    'PLANE_NTS_DB_HOST not set. These create real issues, so they are not run by default. ' +
    'See the header comment for the env, then: npm run test:integration');
}

afterAll(async () => {
  await shutdown();
});

describe('multi-instance connectivity', () => {
  itLive('connects to personal instance', async () => {
    const pool = getPool('personal');
    const result = await pool.query('SELECT 1 as ok');
    expect(result.rows[0].ok).toBe(1);
  });

  itLive('connects to nts instance', async () => {
    const pool = getPool('nts');
    const result = await pool.query('SELECT 1 as ok');
    expect(result.rows[0].ok).toBe(1);
  });

  it('connects to lifedb', async () => {
    const pool = getLifedbPool();
    const result = await pool.query('SELECT 1 as ok');
    expect(result.rows[0].ok).toBe(1);
  });
});

describeLive('listProjects', () => {
  it('lists personal projects', async () => {
    const result = await listProjects('personal');
    expect(result).toContain('HLT');
    expect(result).toContain('Health');
    expect(result).toContain('[personal]');
  });

  it('lists nts projects', async () => {
    const result = await listProjects('nts');
    expect(result).toContain('NTS');
    expect(result).toContain('[nts]');
  });

  // ⭐ THE PARTIAL VIEW MUST DECLARE ITSELF (added 2026-08-13).
  // listProjects is scoped to ONE workspace per instance and filters archived
  // projects. On the `nts` instance that is 4 rows out of 7 non-archived, non-deleted
  // projects — CHARI, RACQU and VERSE live in the `charisse`, `racquelri` and
  // `versedhand` workspaces on the SAME database and were structurally invisible with
  // no error and no hint. A list that is short and a list that is complete looked
  // identical, which is exactly how a caller concludes a project "does not exist".
  //
  // ⚠️ THIS ASSERTS THE DISCLOSURE, NOT THE ROWS. Widening the query to every
  // workspace would be the wrong fix — the tool is deliberately workspace-scoped and
  // its own description says "in the workspace". What was broken was the SILENCE.
  //
  // Red on the pre-fix code: it emitted only `[nts]` + 4 rows and nothing else.
  it('discloses what it excluded on nts (archived + other workspaces)', async () => {
    const result = await listProjects('nts');
    expect(result).toMatch(/Excluded:/);
    // The archived project (EMP) and the three other-workspace projects must both be
    // accounted for by name of cause, and the other workspaces named so the reader can
    // reach them with mcp__plane__query.
    expect(result).toMatch(/archived/);
    expect(result).toMatch(/other workspace/);
    expect(result).toContain('versedhand');
  });

  // personal has an archived project (NSH, archived 2026-05-25) and exactly one
  // workspace, so it exercises the archived half of the footer on its own.
  it('discloses archived projects on personal', async () => {
    const result = await listProjects('personal');
    expect(result).toMatch(/Excluded:.*archived/);
  });
});

describeLive('listIssues', () => {
  it('lists issues with project filter', async () => {
    const result = await listIssues({ project: 'HLT', instance: 'personal' });
    expect(result).toContain('HLT-');
  });

  it('lists issues from nts instance', async () => {
    const result = await listIssues({ project: 'NTS', instance: 'nts' });
    expect(result).toContain('NTS-');
  });

  it('filters by label', async () => {
    const result = await listIssues({ label: 'recurring', instance: 'personal' });
    expect(result).toContain('recurring');
  });
});

describeLive('searchIssues', () => {
  it('searches personal issues', async () => {
    const result = await searchIssues('exercise', 5, 'personal');
    expect(result.toLowerCase()).toContain('exercise');
  });
});

describe('rawQuery', () => {
  // needs a live Plane connection; the DML guard below does NOT and must keep running
  itLive('runs SELECT on personal instance', async () => {
    const result = await rawQuery('SELECT COUNT(*) as cnt FROM projects WHERE deleted_at IS NULL', 'personal');
    expect(result).toContain('cnt');
  });

  it('blocks DML statements', async () => {
    const result = await rawQuery("DELETE FROM issues WHERE id = 'fake'", 'personal');
    expect(result).toContain('Error');
  });
});

describe('tasksDue', () => {
  it('queries all instances', async () => {
    const result = await tasksDue('all');
    // Should return either tasks or "No tasks due"
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('queries single instance', async () => {
    const result = await tasksDue('personal');
    expect(typeof result).toBe('string');
  });
});

// REMOVED 2026-07-31: the `recurrence` describe block tested the sidecar recurrence
// engine, which was ABANDONED 2026-06-26 — it never functioned, and the
// `plane_recurrence` table no longer exists, so both tests failed with
// `relation "plane_recurrence" does not exist` on every run.
//
// They are deleted rather than skipped because a permanently-red suite is a suite
// nobody runs, and this one had been red long enough that a genuine regression
// would have been invisible inside the noise. Recurrence now lives in Google
// Calendar (human-actioned) and etc/scheduled-tasks/ (agent-actioned) — see
// tasks/tasks_system_overview.md. If recurrence ever returns to Plane, write new
// tests against whatever it actually uses; do not restore these.

describeLive('createIssue', () => {
  let testIssueId: string | null = null;

  it('creates issue by project identifier', async () => {
    const result = await createIssue({
      project: 'PRJ',
      name: 'Test issue — delete me',
      priority: 'low',
      target_date: '2099-12-31',
      instance: 'personal',
    });
    expect(result).toContain('PRJ-');
    expect(result).toContain('Test issue');
    const match = result.match(/id: ([0-9a-f-]+)/);
    expect(match).not.toBeNull();
    testIssueId = match![1];
  });

  it('creates issue by project UUID', async () => {
    // Get the PRJ project UUID
    const pool = getPool('personal');
    const proj = await pool.query("SELECT id FROM projects WHERE identifier = 'PRJ' AND deleted_at IS NULL");
    const projectUuid = proj.rows[0].id;

    const result = await createIssue({
      project: projectUuid,
      name: 'Test issue via UUID — delete me',
      priority: 'low',
      target_date: '2099-12-31',
      instance: 'personal',
    });
    expect(result).toContain('PRJ-');

    // Clean up
    const match = result.match(/id: ([0-9a-f-]+)/);
    if (match) {
      await pool.query("UPDATE issues SET deleted_at = NOW() WHERE id = $1", [match[1]]);
    }
  });

  afterAll(async () => {
    // Clean up test issue
    if (testIssueId) {
      const pool = getPool('personal');
      await pool.query("UPDATE issues SET deleted_at = NOW() WHERE id = $1", [testIssueId]);
    }
  });
});

// ⭐ WRITE-PATH REGRESSIONS (2026-11-20, arch-defect-sweep N078). The two silent-failure defects this
// package shipped, plus the cross-project label bug, asserted against the SQL path. Run them only on the
// throwaway DB (scripts/test-live-local.sh sets PLANE_MCP_THROWAWAY_DB=1): they write and do not clean up.
const describeThrowaway = HAS_PLANE_CREDS && process.env.PLANE_MCP_THROWAWAY_DB === '1' ? describe : describe.skip;

describeThrowaway('write-path regressions (throwaway DB only)', () => {
  const idOf = (r: string) => r.match(/id: ([0-9a-f-]+)/)![1];

  it('attaches a label that exists in the project', async () => {
    const r = await createIssue({ project: 'PRJ', name: 'labelled', labels: ['urgent'], instance: 'personal' });
    expect(r).not.toMatch(/NOT ATTACHED/);
    expect(await getIssue(idOf(r), 'personal')).toMatch(/Labels: urgent/);
  });

  it('refuses a label that exists only in ANOTHER project, and creates nothing', async () => {
    const pool = getPool('personal');
    const before = await pool.query("SELECT count(*)::int AS n FROM issues i JOIN projects p ON p.id = i.project_id WHERE p.identifier = 'PRJ'");
    await expect(createIssue({ project: 'PRJ', name: 'wrong label', labels: ['recurring'], instance: 'personal' }))
      .rejects.toThrow(/Label\(s\) not found: recurring/);
    const after = await pool.query("SELECT count(*)::int AS n FROM issues i JOIN projects p ON p.id = i.project_id WHERE p.identifier = 'PRJ'");
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('clearing target_date leaves the issue open (not Done) and reports verified', async () => {
    const r = await createIssue({ project: 'PRJ', name: 'dated', target_date: '2099-12-31', instance: 'personal' });
    const id = idOf(r);
    const u = await updateIssue(id, { target_date: '' }, 'personal');
    expect(u).toMatch(/\(verified\)/);
    const row = await getPool('personal').query(
      'SELECT i.target_date, s."group" AS g FROM issues i JOIN states s ON s.id = i.state_id WHERE i.id = $1', [id]);
    expect(row.rows[0].target_date).toBeNull();
    expect(row.rows[0].g).not.toBe('completed');
  });

  it('a state change to Done is applied and stamps completed_at', async () => {
    const r = await createIssue({ project: 'PRJ', name: 'to finish', instance: 'personal' });
    const id = idOf(r);
    expect(await updateIssue(id, { state: 'Done' }, 'personal')).toMatch(/\(verified\)/);
    const row = await getPool('personal').query(
      'SELECT i.completed_at, s."group" AS g FROM issues i JOIN states s ON s.id = i.state_id WHERE i.id = $1', [id]);
    expect(row.rows[0].g).toBe('completed');
    expect(row.rows[0].completed_at).not.toBeNull();
  });
});
