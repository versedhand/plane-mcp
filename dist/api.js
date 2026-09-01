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
import { getInstanceConfig } from './db.js';
const apiConfigs = new Map();
function loadApiConfig(name) {
    const prefix = `PLANE_${name.toUpperCase()}_`;
    const baseUrl = process.env[`${prefix}API_URL`];
    const apiKey = process.env[`${prefix}API_KEY`];
    if (!baseUrl || !apiKey)
        return null;
    // Get workspace slug from the existing DB config
    const dbConfig = getInstanceConfig(name);
    return {
        baseUrl: baseUrl.replace(/\/+$/, ''), // strip trailing slash
        apiKey,
        workspaceSlug: dbConfig.workspaceSlug,
    };
}
export function getApiConfig(instance) {
    if (!apiConfigs.has(instance)) {
        const config = loadApiConfig(instance);
        if (config)
            apiConfigs.set(instance, config);
    }
    const config = apiConfigs.get(instance);
    if (!config) {
        throw new Error(`Plane API not configured for '${instance}'. ` +
            `Set PLANE_${instance.toUpperCase()}_API_URL and PLANE_${instance.toUpperCase()}_API_KEY.`);
    }
    return config;
}
export function hasApiConfig(instance) {
    if (apiConfigs.has(instance))
        return true;
    const config = loadApiConfig(instance);
    if (config) {
        apiConfigs.set(instance, config);
        return true;
    }
    return false;
}
async function apiRequest(method, path, instance, body) {
    const config = getApiConfig(instance);
    const url = `${config.baseUrl}${path}`;
    const headers = {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
    };
    const fetchOpts = { method, headers };
    if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
        fetchOpts.body = JSON.stringify(body);
    }
    const resp = await fetch(url, fetchOpts);
    let data = null;
    if (resp.status !== 204) {
        const text = await resp.text();
        try {
            data = JSON.parse(text);
        }
        catch {
            data = text;
        }
    }
    if (!resp.ok) {
        const detail = typeof data === 'object' ? JSON.stringify(data) : String(data || resp.statusText);
        throw new Error(`Plane API ${method} ${path} failed (${resp.status}): ${detail}`);
    }
    return { ok: true, status: resp.status, data };
}
export async function apiCreateWorkItem(projectId, params, instance) {
    const config = getApiConfig(instance);
    const path = `/api/v1/workspaces/${config.workspaceSlug}/projects/${projectId}/work-items/`;
    const body = { name: params.name };
    if (params.priority)
        body.priority = params.priority;
    if (params.state)
        body.state = params.state;
    if (params.assignees?.length)
        body.assignees = params.assignees;
    if (params.labels?.length)
        body.labels = params.labels;
    if (params.description_html)
        body.description_html = params.description_html;
    if (params.start_date !== undefined)
        body.start_date = params.start_date;
    if (params.target_date !== undefined)
        body.target_date = params.target_date;
    const resp = await apiRequest('POST', path, instance, body);
    return resp.data;
}
export async function apiUpdateWorkItem(projectId, workItemId, params, instance) {
    const config = getApiConfig(instance);
    const path = `/api/v1/workspaces/${config.workspaceSlug}/projects/${projectId}/work-items/${workItemId}/`;
    const body = {};
    if (params.name !== undefined)
        body.name = params.name;
    if (params.priority !== undefined)
        body.priority = params.priority;
    if (params.state !== undefined)
        body.state = params.state;
    if (params.assignees !== undefined)
        body.assignees = params.assignees;
    if (params.labels !== undefined)
        body.labels = params.labels;
    if (params.description_html !== undefined)
        body.description_html = params.description_html;
    if (params.start_date !== undefined)
        body.start_date = params.start_date;
    if (params.target_date !== undefined)
        body.target_date = params.target_date;
    if (params.completed_at !== undefined)
        body.completed_at = params.completed_at;
    const resp = await apiRequest('PATCH', path, instance, body);
    return resp.data;
}
//# sourceMappingURL=api.js.map