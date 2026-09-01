/**
 * Plane REST API client for mutations.
 *
 * Reads use direct SQL (faster, no token needed).
 * Mutations go through the REST API so Plane's Django app can
 * trigger notifications, activity logs, webhooks, etc.
 *
 * API docs: https://developers.plane.so/api-reference/introduction
 * Endpoints use /api/v1/workspaces/{slug}/projects/{project_id}/work-items/
 * Auth: X-API-Key header with a personal access token.
 */
import type { InstanceName } from './db.js';
interface ApiConfig {
    baseUrl: string;
    apiKey: string;
    workspaceSlug: string;
}
export declare function getApiConfig(instance: InstanceName): ApiConfig;
export declare function hasApiConfig(instance: InstanceName): boolean;
export interface CreateWorkItemParams {
    name: string;
    priority?: string;
    state?: string;
    assignees?: string[];
    labels?: string[];
    description_html?: string;
    start_date?: string | null;
    target_date?: string | null;
}
export interface CreateWorkItemResponse {
    id: string;
    name: string;
    sequence_id: number;
    priority: string;
    state: string;
    assignees: string[];
    labels: string[];
    completed_at: string | null;
    created_at: string;
}
export declare function apiCreateWorkItem(projectId: string, params: CreateWorkItemParams, instance: InstanceName): Promise<CreateWorkItemResponse>;
export interface UpdateWorkItemParams {
    name?: string;
    priority?: string;
    state?: string;
    assignees?: string[];
    labels?: string[];
    description_html?: string;
    start_date?: string | null;
    target_date?: string | null;
    completed_at?: string | null;
}
export declare function apiUpdateWorkItem(projectId: string, workItemId: string, params: UpdateWorkItemParams, instance: InstanceName): Promise<any>;
export {};
