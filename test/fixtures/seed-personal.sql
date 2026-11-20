-- Synthetic `personal` instance: what src/queries.test.ts asserts against, and nothing real.
\set ON_ERROR_STOP on
\i test/fixtures/seed-lib.sql
DO $$
DECLARE u uuid := gen_random_uuid(); w uuid := gen_random_uuid();
        hlt uuid := gen_random_uuid(); prj uuid := gen_random_uuid(); nsh uuid := gen_random_uuid(); i uuid;
BEGIN
  PERFORM pg_temp.seed('users', jsonb_build_object('id',u,'email','tester@example.invalid','first_name','Tester','username','tester','is_active',true,'password','!'));
  PERFORM pg_temp.seed('workspaces', jsonb_build_object('id',w,'name','Personal','slug','personal','owner_id',u,'deleted_at',null));
  PERFORM pg_temp.seed('projects', jsonb_build_object('id',hlt,'name','Health','identifier','HLT','workspace_id',w,'deleted_at',null,'archived_at',null));
  PERFORM pg_temp.seed('projects', jsonb_build_object('id',prj,'name','Projects','identifier','PRJ','workspace_id',w,'deleted_at',null,'archived_at',null));
  PERFORM pg_temp.seed('projects', jsonb_build_object('id',nsh,'name','Archived','identifier','NSH','workspace_id',w,'deleted_at',null,'archived_at',now()));
  PERFORM pg_temp.states(hlt, w); PERFORM pg_temp.states(prj, w); PERFORM pg_temp.states(nsh, w);
  PERFORM pg_temp.seed('labels', jsonb_build_object('name','recurring','project_id',hlt,'workspace_id',w,'color','#ccc','sort_order',65535,'deleted_at',null));
  PERFORM pg_temp.seed('labels', jsonb_build_object('name','urgent','project_id',prj,'workspace_id',w,'color','#ccc','sort_order',65535,'deleted_at',null));
  -- a same-named label in ANOTHER project: label resolution must not attach it (743573e)
  PERFORM pg_temp.seed('labels', jsonb_build_object('name','recurring','project_id',nsh,'workspace_id',w,'color','#ccc','sort_order',65535,'deleted_at',null));
  i := pg_temp.issue(hlt, w, 1, 'Daily exercise', 'unstarted');
  PERFORM pg_temp.seed('issue_labels', jsonb_build_object('issue_id',i,'label_id',(SELECT id FROM labels WHERE project_id=hlt AND name='recurring'),'project_id',hlt,'workspace_id',w));
  PERFORM pg_temp.issue(prj, w, 1, 'Seed project task', 'unstarted');
END $$;
