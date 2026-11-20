-- Synthetic `nts` instance: one in-scope project, one archived, one in another workspace (the
-- "Excluded:" disclosure test), nothing real.
\set ON_ERROR_STOP on
\i test/fixtures/seed-lib.sql
DO $$
DECLARE u uuid := gen_random_uuid(); w uuid := gen_random_uuid(); w2 uuid := gen_random_uuid();
        nts uuid := gen_random_uuid(); emp uuid := gen_random_uuid(); vrs uuid := gen_random_uuid();
BEGIN
  PERFORM pg_temp.seed('users', jsonb_build_object('id',u,'email','tester@example.invalid','first_name','Tester','username','tester','is_active',true,'password','!'));
  PERFORM pg_temp.seed('workspaces', jsonb_build_object('id',w,'name','NTS','slug','nts','owner_id',u,'deleted_at',null));
  PERFORM pg_temp.seed('workspaces', jsonb_build_object('id',w2,'name','Versed Hand','slug','versedhand','owner_id',u,'deleted_at',null));
  PERFORM pg_temp.seed('projects', jsonb_build_object('id',nts,'name','NTS','identifier','NTS','workspace_id',w,'deleted_at',null,'archived_at',null));
  PERFORM pg_temp.seed('projects', jsonb_build_object('id',emp,'name','Employees','identifier','EMP','workspace_id',w,'deleted_at',null,'archived_at',now()));
  PERFORM pg_temp.seed('projects', jsonb_build_object('id',vrs,'name','Versed','identifier','VERSE','workspace_id',w2,'deleted_at',null,'archived_at',null));
  PERFORM pg_temp.states(nts, w); PERFORM pg_temp.states(vrs, w2);
  PERFORM pg_temp.issue(nts, w, 1, 'Seed NTS task', 'unstarted');
END $$;
