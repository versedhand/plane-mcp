-- Plane schema subset for plane-mcp's throwaway live-DB tests (scripts/test-live-local.sh).
-- Source: pg_dump --schema-only --no-owner --no-privileges of the 11 tables plane-mcp reads/writes, Plane
-- on Postgres 15.7, 2026-11-20. Structure only: NO DATA. Dropped: outbox triggers (their functions and
-- target tables are outside this subset) and FKs to tables outside it (estimates, file_assets, issue_types).
-- Refresh after a Plane upgrade the same way; never load data from a live instance.


SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;


SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE public.issue_assignees (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    assignee_id uuid NOT NULL,
    created_by_id uuid,
    issue_id uuid NOT NULL,
    project_id uuid NOT NULL,
    updated_by_id uuid,
    workspace_id uuid NOT NULL,
    deleted_at timestamp with time zone
);

CREATE TABLE public.issue_labels (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    created_by_id uuid,
    issue_id uuid NOT NULL,
    label_id uuid NOT NULL,
    project_id uuid NOT NULL,
    updated_by_id uuid,
    workspace_id uuid NOT NULL,
    deleted_at timestamp with time zone
);

CREATE TABLE public.issue_sequences (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    sequence bigint NOT NULL,
    deleted boolean NOT NULL,
    created_by_id uuid,
    issue_id uuid,
    project_id uuid NOT NULL,
    updated_by_id uuid,
    workspace_id uuid NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT issue_sequence_sequence_check CHECK ((sequence >= 0))
);

CREATE TABLE public.issues (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description jsonb NOT NULL,
    priority character varying(30) NOT NULL,
    start_date date,
    target_date date,
    sequence_id integer NOT NULL,
    created_by_id uuid,
    parent_id uuid,
    project_id uuid NOT NULL,
    state_id uuid,
    updated_by_id uuid,
    workspace_id uuid NOT NULL,
    description_html text NOT NULL,
    description_stripped text,
    completed_at timestamp with time zone,
    sort_order double precision NOT NULL,
    point integer,
    archived_at date,
    is_draft boolean NOT NULL,
    external_id character varying(255),
    external_source character varying(255),
    description_binary bytea,
    estimate_point_id uuid,
    type_id uuid,
    deleted_at timestamp with time zone
);

CREATE TABLE public.labels (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    created_by_id uuid,
    project_id uuid,
    updated_by_id uuid,
    workspace_id uuid NOT NULL,
    parent_id uuid,
    color character varying(255) NOT NULL,
    sort_order double precision NOT NULL,
    external_id character varying(255),
    external_source character varying(255),
    deleted_at timestamp with time zone
);

CREATE TABLE public.project_members (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    comment text,
    role smallint NOT NULL,
    created_by_id uuid,
    member_id uuid,
    project_id uuid NOT NULL,
    updated_by_id uuid,
    workspace_id uuid NOT NULL,
    view_props jsonb NOT NULL,
    default_props jsonb NOT NULL,
    sort_order double precision NOT NULL,
    preferences jsonb NOT NULL,
    is_active boolean NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT project_member_role_check CHECK ((role >= 0))
);

CREATE TABLE public.projects (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    description_text jsonb,
    description_html jsonb,
    network smallint NOT NULL,
    identifier character varying(12) NOT NULL,
    created_by_id uuid,
    default_assignee_id uuid,
    project_lead_id uuid,
    updated_by_id uuid,
    workspace_id uuid NOT NULL,
    emoji character varying(255),
    cycle_view boolean NOT NULL,
    module_view boolean NOT NULL,
    cover_image text,
    issue_views_view boolean NOT NULL,
    page_view boolean NOT NULL,
    estimate_id uuid,
    icon_prop jsonb,
    intake_view boolean NOT NULL,
    archive_in integer NOT NULL,
    close_in integer NOT NULL,
    default_state_id uuid,
    logo_props jsonb NOT NULL,
    archived_at timestamp with time zone,
    is_time_tracking_enabled boolean NOT NULL,
    is_issue_type_enabled boolean NOT NULL,
    deleted_at timestamp with time zone,
    guest_view_all_features boolean NOT NULL,
    timezone character varying(255) NOT NULL,
    cover_image_asset_id uuid,
    external_id character varying(255),
    external_source character varying(255),
    CONSTRAINT project_network_check CHECK ((network >= 0))
);

CREATE TABLE public.states (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    color character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    created_by_id uuid,
    project_id uuid NOT NULL,
    updated_by_id uuid,
    workspace_id uuid NOT NULL,
    sequence double precision NOT NULL,
    "group" character varying(20) NOT NULL,
    "default" boolean NOT NULL,
    external_id character varying(255),
    external_source character varying(255),
    is_triage boolean NOT NULL,
    deleted_at timestamp with time zone
);

CREATE TABLE public.users (
    password character varying(128) NOT NULL,
    last_login timestamp with time zone,
    id uuid NOT NULL,
    username character varying(128) NOT NULL,
    mobile_number character varying(255),
    email character varying(255),
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    avatar text NOT NULL,
    date_joined timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    last_location character varying(255) NOT NULL,
    created_location character varying(255) NOT NULL,
    is_superuser boolean NOT NULL,
    is_managed boolean NOT NULL,
    is_password_expired boolean NOT NULL,
    is_active boolean NOT NULL,
    is_staff boolean NOT NULL,
    is_email_verified boolean NOT NULL,
    is_password_autoset boolean NOT NULL,
    token character varying(64) NOT NULL,
    user_timezone character varying(255) NOT NULL,
    last_active timestamp with time zone,
    last_login_time timestamp with time zone,
    last_logout_time timestamp with time zone,
    last_login_ip character varying(255) NOT NULL,
    last_logout_ip character varying(255) NOT NULL,
    last_login_medium character varying(20) NOT NULL,
    last_login_uagent text NOT NULL,
    token_updated_at timestamp with time zone,
    is_bot boolean NOT NULL,
    cover_image character varying(800),
    display_name character varying(255) NOT NULL,
    avatar_asset_id uuid,
    cover_image_asset_id uuid,
    bot_type character varying(30),
    is_email_valid boolean NOT NULL,
    masked_at timestamp with time zone,
    is_password_reset_required boolean NOT NULL
);

CREATE TABLE public.workspace_members (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    role smallint NOT NULL,
    created_by_id uuid,
    member_id uuid NOT NULL,
    updated_by_id uuid,
    workspace_id uuid NOT NULL,
    company_role text,
    view_props jsonb NOT NULL,
    default_props jsonb NOT NULL,
    issue_props jsonb NOT NULL,
    is_active boolean NOT NULL,
    deleted_at timestamp with time zone,
    explored_features jsonb NOT NULL,
    getting_started_checklist jsonb NOT NULL,
    tips jsonb NOT NULL,
    CONSTRAINT workspace_member_role_check CHECK ((role >= 0))
);

CREATE TABLE public.workspaces (
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    name character varying(80) NOT NULL,
    logo text,
    slug character varying(48) NOT NULL,
    created_by_id uuid,
    owner_id uuid NOT NULL,
    updated_by_id uuid,
    organization_size character varying(20),
    deleted_at timestamp with time zone,
    logo_asset_id uuid,
    timezone character varying(255) NOT NULL,
    background_color character varying(255) NOT NULL
);

ALTER TABLE ONLY public.issue_assignees
    ADD CONSTRAINT issue_assignee_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.issue_assignees
    ADD CONSTRAINT issue_assignees_issue_id_assignee_id_deleted_at_b2623a0e_uniq UNIQUE (issue_id, assignee_id, deleted_at);

ALTER TABLE ONLY public.issue_labels
    ADD CONSTRAINT issue_label_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issue_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.issue_sequences
    ADD CONSTRAINT issue_sequence_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT label_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_member_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_member_id_deleted_at_0299122d_uniq UNIQUE (project_id, member_id, deleted_at);

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT project_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_identifier_workspace_id_deleted_at_7d2fa8c1_uniq UNIQUE (identifier, workspace_id, deleted_at);

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_name_workspace_id_deleted_at_c7aa56f7_uniq UNIQUE (name, workspace_id, deleted_at);

ALTER TABLE ONLY public.states
    ADD CONSTRAINT state_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_name_project_id_deleted_at_02f90488_uniq UNIQUE (name, project_id, deleted_at);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT user_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT user_username_key UNIQUE (username);

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_member_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_member_id_d_d7bfa872_uniq UNIQUE (workspace_id, member_id, deleted_at);

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspace_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspace_slug_key UNIQUE (slug);

CREATE INDEX issue_assignee_assignee_id_50f5c04e ON public.issue_assignees USING btree (assignee_id);

CREATE INDEX issue_assignee_created_by_id_f693d43b ON public.issue_assignees USING btree (created_by_id);

CREATE INDEX issue_assignee_issue_id_72da08db ON public.issue_assignees USING btree (issue_id);

CREATE INDEX issue_assignee_project_id_61c18bf2 ON public.issue_assignees USING btree (project_id);

CREATE UNIQUE INDEX issue_assignee_unique_issue_assignee_when_deleted_at_null ON public.issue_assignees USING btree (issue_id, assignee_id) WHERE (deleted_at IS NULL);

CREATE INDEX issue_assignee_updated_by_id_c54088aa ON public.issue_assignees USING btree (updated_by_id);

CREATE INDEX issue_assignee_workspace_id_9aad55b7 ON public.issue_assignees USING btree (workspace_id);

CREATE INDEX issue_created_by_id_8f0ae62b ON public.issues USING btree (created_by_id);

CREATE INDEX issue_label_created_by_id_94075315 ON public.issue_labels USING btree (created_by_id);

CREATE INDEX issue_label_issue_id_0f252e52 ON public.issue_labels USING btree (issue_id);

CREATE INDEX issue_label_label_id_5f22777f ON public.issue_labels USING btree (label_id);

CREATE INDEX issue_label_project_id_eaa2ba39 ON public.issue_labels USING btree (project_id);

CREATE INDEX issue_label_updated_by_id_a97a6733 ON public.issue_labels USING btree (updated_by_id);

CREATE INDEX issue_label_workspace_id_b5b1faac ON public.issue_labels USING btree (workspace_id);

CREATE INDEX issue_parent_id_ce8d76ba ON public.issues USING btree (parent_id);

CREATE INDEX issue_project_id_fea0fc80 ON public.issues USING btree (project_id);

CREATE INDEX issue_sequence_created_by_id_59270506 ON public.issue_sequences USING btree (created_by_id);

CREATE INDEX issue_sequence_issue_id_16e9f00f ON public.issue_sequences USING btree (issue_id);

CREATE INDEX issue_sequence_project_id_ce882e85 ON public.issue_sequences USING btree (project_id);

CREATE INDEX issue_sequence_updated_by_id_310c8dd3 ON public.issue_sequences USING btree (updated_by_id);

CREATE INDEX issue_sequence_workspace_id_0d3f0fd4 ON public.issue_sequences USING btree (workspace_id);

CREATE INDEX issue_sequences_sequence_2c9458d4 ON public.issue_sequences USING btree (sequence);

CREATE INDEX issue_state_id_1a65560d ON public.issues USING btree (state_id);

CREATE INDEX issue_updated_by_id_f1261863 ON public.issues USING btree (updated_by_id);

CREATE INDEX issue_workspace_id_c84878c1 ON public.issues USING btree (workspace_id);

CREATE INDEX issues_estimate_point_id_a6822abe ON public.issues USING btree (estimate_point_id);

CREATE INDEX issues_type_id_a4710b19 ON public.issues USING btree (type_id);

CREATE INDEX label_created_by_id_aa6ffcfa ON public.labels USING btree (created_by_id);

CREATE INDEX label_parent_id_7a853296 ON public.labels USING btree (parent_id);

CREATE INDEX label_project_id_90e0f1a2 ON public.labels USING btree (project_id);

CREATE INDEX label_updated_by_id_894a5464 ON public.labels USING btree (updated_by_id);

CREATE INDEX label_workspace_id_c4c9ae5a ON public.labels USING btree (workspace_id);

CREATE INDEX project_created_by_id_6cc13408 ON public.projects USING btree (created_by_id);

CREATE INDEX project_default_assignee_id_6ba45f90 ON public.projects USING btree (default_assignee_id);

CREATE INDEX project_member_created_by_id_8b363306 ON public.project_members USING btree (created_by_id);

CREATE INDEX project_member_member_id_9d6b126b ON public.project_members USING btree (member_id);

CREATE INDEX project_member_project_id_11ea1a9e ON public.project_members USING btree (project_id);

CREATE UNIQUE INDEX project_member_unique_project_member_when_deleted_at_null ON public.project_members USING btree (project_id, member_id) WHERE (deleted_at IS NULL);

CREATE INDEX project_member_updated_by_id_cf6aaac4 ON public.project_members USING btree (updated_by_id);

CREATE INDEX project_member_workspace_id_88bb9a97 ON public.project_members USING btree (workspace_id);

CREATE INDEX project_project_lead_id_caf8e353 ON public.projects USING btree (project_lead_id);

CREATE UNIQUE INDEX project_unique_identifier_workspace_when_deleted_at_null ON public.projects USING btree (identifier, workspace_id) WHERE (deleted_at IS NULL);

CREATE UNIQUE INDEX project_unique_name_workspace_when_deleted_at_null ON public.projects USING btree (name, workspace_id) WHERE (deleted_at IS NULL);

CREATE INDEX project_updated_by_id_fe290525 ON public.projects USING btree (updated_by_id);

CREATE INDEX project_workspace_id_01764ff9 ON public.projects USING btree (workspace_id);

CREATE INDEX projects_cover_image_asset_id_e6636b92 ON public.projects USING btree (cover_image_asset_id);

CREATE INDEX projects_default_state_id_f13e8b95 ON public.projects USING btree (default_state_id);

CREATE INDEX projects_estimate_id_85c7b2ac ON public.projects USING btree (estimate_id);

CREATE INDEX projects_identifier_3267ade8 ON public.projects USING btree (identifier);

CREATE INDEX projects_identifier_3267ade8_like ON public.projects USING btree (identifier varchar_pattern_ops);

CREATE INDEX state_created_by_id_ff51a50d ON public.states USING btree (created_by_id);

CREATE INDEX state_project_id_23a65fd6 ON public.states USING btree (project_id);

CREATE INDEX state_slug_bab0af35 ON public.states USING btree (slug);

CREATE INDEX state_slug_bab0af35_like ON public.states USING btree (slug varchar_pattern_ops);

CREATE UNIQUE INDEX state_unique_name_project_when_deleted_at_null ON public.states USING btree (name, project_id) WHERE (deleted_at IS NULL);

CREATE INDEX state_updated_by_id_be298453 ON public.states USING btree (updated_by_id);

CREATE INDEX state_workspace_id_2293282d ON public.states USING btree (workspace_id);

CREATE UNIQUE INDEX unique_name_when_project_null_and_not_deleted ON public.labels USING btree (name) WHERE ((deleted_at IS NULL) AND (project_id IS NULL));

CREATE UNIQUE INDEX unique_project_name_when_not_deleted ON public.labels USING btree (project_id, name) WHERE ((deleted_at IS NULL) AND (project_id IS NOT NULL));

CREATE INDEX user_email_54dc62b2_like ON public.users USING btree (email varchar_pattern_ops);

CREATE INDEX user_username_cf016618_like ON public.users USING btree (username varchar_pattern_ops);

CREATE INDEX users_avatar_asset_id_50fa2043 ON public.users USING btree (avatar_asset_id);

CREATE INDEX users_cover_image_asset_id_b9679cbc ON public.users USING btree (cover_image_asset_id);

CREATE INDEX workspace_created_by_id_10ad894e ON public.workspaces USING btree (created_by_id);

CREATE INDEX workspace_member_created_by_id_8dc8b040 ON public.workspace_members USING btree (created_by_id);

CREATE INDEX workspace_member_member_id_824f5497 ON public.workspace_members USING btree (member_id);

CREATE UNIQUE INDEX workspace_member_unique_workspace_member_when_deleted_at_null ON public.workspace_members USING btree (workspace_id, member_id) WHERE (deleted_at IS NULL);

CREATE INDEX workspace_member_updated_by_id_1cec0062 ON public.workspace_members USING btree (updated_by_id);

CREATE INDEX workspace_member_workspace_id_33f66d4b ON public.workspace_members USING btree (workspace_id);

CREATE INDEX workspace_owner_id_60a8bafc ON public.workspaces USING btree (owner_id);

CREATE INDEX workspace_slug_4d89d459_like ON public.workspaces USING btree (slug varchar_pattern_ops);

CREATE INDEX workspace_updated_by_id_09d249ed ON public.workspaces USING btree (updated_by_id);

CREATE INDEX workspaces_logo_asset_id_a784bb00 ON public.workspaces USING btree (logo_asset_id);

ALTER TABLE ONLY public.issue_assignees
    ADD CONSTRAINT issue_assignee_assignee_id_50f5c04e_fk_user_id FOREIGN KEY (assignee_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_assignees
    ADD CONSTRAINT issue_assignee_created_by_id_f693d43b_fk_user_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_assignees
    ADD CONSTRAINT issue_assignee_issue_id_72da08db_fk_issue_id FOREIGN KEY (issue_id) REFERENCES public.issues(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_assignees
    ADD CONSTRAINT issue_assignee_project_id_61c18bf2_fk_project_id FOREIGN KEY (project_id) REFERENCES public.projects(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_assignees
    ADD CONSTRAINT issue_assignee_updated_by_id_c54088aa_fk_user_id FOREIGN KEY (updated_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_assignees
    ADD CONSTRAINT issue_assignee_workspace_id_9aad55b7_fk_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issue_created_by_id_8f0ae62b_fk_user_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_labels
    ADD CONSTRAINT issue_label_created_by_id_94075315_fk_user_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_labels
    ADD CONSTRAINT issue_label_issue_id_0f252e52_fk_issue_id FOREIGN KEY (issue_id) REFERENCES public.issues(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_labels
    ADD CONSTRAINT issue_label_label_id_5f22777f_fk_label_id FOREIGN KEY (label_id) REFERENCES public.labels(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_labels
    ADD CONSTRAINT issue_label_project_id_eaa2ba39_fk_project_id FOREIGN KEY (project_id) REFERENCES public.projects(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_labels
    ADD CONSTRAINT issue_label_updated_by_id_a97a6733_fk_user_id FOREIGN KEY (updated_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_labels
    ADD CONSTRAINT issue_label_workspace_id_b5b1faac_fk_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issue_parent_id_ce8d76ba_fk_issue_id FOREIGN KEY (parent_id) REFERENCES public.issues(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issue_project_id_fea0fc80_fk_project_id FOREIGN KEY (project_id) REFERENCES public.projects(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_sequences
    ADD CONSTRAINT issue_sequence_created_by_id_59270506_fk_user_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_sequences
    ADD CONSTRAINT issue_sequence_issue_id_16e9f00f_fk_issue_id FOREIGN KEY (issue_id) REFERENCES public.issues(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_sequences
    ADD CONSTRAINT issue_sequence_project_id_ce882e85_fk_project_id FOREIGN KEY (project_id) REFERENCES public.projects(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_sequences
    ADD CONSTRAINT issue_sequence_updated_by_id_310c8dd3_fk_user_id FOREIGN KEY (updated_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issue_sequences
    ADD CONSTRAINT issue_sequence_workspace_id_0d3f0fd4_fk_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issue_state_id_1a65560d_fk_state_id FOREIGN KEY (state_id) REFERENCES public.states(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issue_updated_by_id_f1261863_fk_user_id FOREIGN KEY (updated_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issue_workspace_id_c84878c1_fk_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT label_created_by_id_aa6ffcfa_fk_user_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT label_parent_id_7a853296_fk_label_id FOREIGN KEY (parent_id) REFERENCES public.labels(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT label_updated_by_id_894a5464_fk_user_id FOREIGN KEY (updated_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT label_workspace_id_c4c9ae5a_fk_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_project_id_cf57a802_fk_projects_id FOREIGN KEY (project_id) REFERENCES public.projects(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT project_created_by_id_6cc13408_fk_user_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT project_default_assignee_id_6ba45f90_fk_user_id FOREIGN KEY (default_assignee_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_member_created_by_id_8b363306_fk_user_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_member_member_id_9d6b126b_fk_user_id FOREIGN KEY (member_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_member_project_id_11ea1a9e_fk_project_id FOREIGN KEY (project_id) REFERENCES public.projects(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_member_updated_by_id_cf6aaac4_fk_user_id FOREIGN KEY (updated_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_member_workspace_id_88bb9a97_fk_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT project_project_lead_id_caf8e353_fk_user_id FOREIGN KEY (project_lead_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT project_updated_by_id_fe290525_fk_user_id FOREIGN KEY (updated_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT project_workspace_id_01764ff9_fk_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_default_state_id_f13e8b95_fk_states_id FOREIGN KEY (default_state_id) REFERENCES public.states(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.states
    ADD CONSTRAINT state_created_by_id_ff51a50d_fk_user_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.states
    ADD CONSTRAINT state_project_id_23a65fd6_fk_project_id FOREIGN KEY (project_id) REFERENCES public.projects(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.states
    ADD CONSTRAINT state_updated_by_id_be298453_fk_user_id FOREIGN KEY (updated_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.states
    ADD CONSTRAINT state_workspace_id_2293282d_fk_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspace_created_by_id_10ad894e_fk_user_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_member_created_by_id_8dc8b040_fk_user_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_member_member_id_824f5497_fk_user_id FOREIGN KEY (member_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_member_updated_by_id_1cec0062_fk_user_id FOREIGN KEY (updated_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_member_workspace_id_33f66d4b_fk_workspace_id FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspace_owner_id_60a8bafc_fk_user_id FOREIGN KEY (owner_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspace_updated_by_id_09d249ed_fk_user_id FOREIGN KEY (updated_by_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;

