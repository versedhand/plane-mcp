export interface PlaneIssue {
    id: string;
    name: string;
    priority: string;
    state_name: string;
    state_group: string;
    project_name: string;
    project_identifier: string;
    sequence_id: number;
    assignees: string[];
    labels: string[];
    start_date: string | null;
    target_date: string | null;
    completed_at: string | null;
    created_at: string;
}
export interface PlaneProject {
    id: string;
    name: string;
    identifier: string;
    issue_count: number;
    open_count: number;
}
export declare const PRIORITIES: Record<string, string>;
export declare const STATE_GROUPS: readonly ["backlog", "unstarted", "started", "completed", "cancelled"];
