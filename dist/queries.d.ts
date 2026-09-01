import type { InstanceName } from './db.js';
export declare function listProjects(instance?: InstanceName): Promise<string>;
export declare function listIssues(opts: {
    project?: string;
    state?: string;
    assignee?: string;
    priority?: string;
    label?: string;
    limit?: number;
    instance?: InstanceName;
}): Promise<string>;
export declare function getIssue(issueId: string, instance?: InstanceName): Promise<string>;
export declare function createIssue(opts: {
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
}): Promise<string>;
export declare function updateIssue(issueId: string, updates: {
    name?: string;
    priority?: string;
    state?: string;
    assignee?: string;
    target_date?: string;
    start_date?: string;
    description?: string;
    labels?: string[];
}, instance?: InstanceName): Promise<string>;
export declare function completeIssue(issueIds: string[], instance?: InstanceName): Promise<string>;
export declare function tasksDue(instance?: InstanceName | 'all'): Promise<string>;
export declare function searchIssues(searchText: string, limit?: number, instance?: InstanceName): Promise<string>;
export declare function rawQuery(sql: string, instance?: InstanceName): Promise<string>;
