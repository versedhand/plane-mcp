-- seed(table, jsonb): insert one row, taking the given columns from the jsonb and filling every other
-- NOT NULL column that has no default with a type-appropriate dummy. Plane's tables carry dozens of
-- NOT NULL bookkeeping columns; this keeps the fixtures to the columns plane-mcp actually reads, and
-- survives a Plane upgrade that adds columns (refresh plane-schema.sql, the seeds keep working).
CREATE OR REPLACE FUNCTION pg_temp.seed(t text, vals jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c record; cols text[] := '{}'; exprs text[] := '{}';
BEGIN
  FOR c IN
    SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS typ, a.attnotnull AS notnull,
           pg_get_expr(d.adbin, d.adrelid) AS def, t2.typcategory AS cat
    FROM pg_attribute a JOIN pg_type t2 ON t2.oid = a.atttypid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = ('public.' || t)::regclass AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum
  LOOP
    IF vals ? c.name THEN
      cols := cols || quote_ident(c.name);
      exprs := exprs || CASE WHEN vals->c.name = 'null'::jsonb THEN 'NULL'
                             ELSE format('CAST(%L AS %s)', vals->>c.name, c.typ) END;
    ELSIF c.notnull AND c.def IS NULL THEN
      cols := cols || quote_ident(c.name);
      exprs := exprs || CASE
        WHEN c.typ = 'uuid' THEN 'gen_random_uuid()'
        WHEN c.cat = 'A' THEN format('CAST(%L AS %s)', '{}', c.typ)
        WHEN c.typ IN ('jsonb', 'json') THEN format('CAST(%L AS %s)', '{}', c.typ)
        WHEN c.cat = 'B' THEN 'false'
        WHEN c.cat = 'N' THEN '0'
        WHEN c.cat = 'D' THEN 'now()'
        ELSE format('CAST(%L AS %s)', 'x', c.typ) END;
    END IF;
  END LOOP;
  EXECUTE format('INSERT INTO public.%I (%s) VALUES (%s)', t, array_to_string(cols, ','), array_to_string(exprs, ','));
END $$;

-- states(project, workspace): Plane's five default groups, sequence-ordered like a real project.
CREATE OR REPLACE FUNCTION pg_temp.states(p uuid, w uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.seed('states', jsonb_build_object('name','Backlog','group','backlog','sequence',15000,'project_id',p,'workspace_id',w,'color','#ccc','default',false));
  PERFORM pg_temp.seed('states', jsonb_build_object('name','Todo','group','unstarted','sequence',25000,'project_id',p,'workspace_id',w,'color','#ccc','default',true));
  PERFORM pg_temp.seed('states', jsonb_build_object('name','In Progress','group','started','sequence',35000,'project_id',p,'workspace_id',w,'color','#ccc','default',false));
  PERFORM pg_temp.seed('states', jsonb_build_object('name','Done','group','completed','sequence',45000,'project_id',p,'workspace_id',w,'color','#ccc','default',false));
  PERFORM pg_temp.seed('states', jsonb_build_object('name','Cancelled','group','cancelled','sequence',55000,'project_id',p,'workspace_id',w,'color','#ccc','default',false));
END $$;

-- issue(project, workspace, seq, name, state-group): one issue in the first state of that group.
CREATE OR REPLACE FUNCTION pg_temp.issue(p uuid, w uuid, seq int, nm text, grp text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE i uuid := gen_random_uuid(); s uuid;
BEGIN
  SELECT id INTO s FROM states WHERE project_id = p AND "group" = grp ORDER BY sequence LIMIT 1;
  PERFORM pg_temp.seed('issues', jsonb_build_object('id',i,'name',nm,'project_id',p,'workspace_id',w,'state_id',s,
    'sequence_id',seq,'sort_order',seq*65536,'priority','none','is_draft',false,'description','{}',
    'description_html','','description_stripped','','deleted_at',null,'target_date',null,'completed_at',null));
  PERFORM pg_temp.seed('issue_sequences', jsonb_build_object('issue_id',i,'project_id',p,'workspace_id',w,'sequence',seq,'deleted',false));
  RETURN i;
END $$;
