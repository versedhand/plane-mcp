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

// Priority mapping: Plane uses string values
export const PRIORITIES: Record<string, string> = {
  urgent: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
  none: 'none',
};

// State groups in Plane
export const STATE_GROUPS = ['backlog', 'unstarted', 'started', 'completed', 'cancelled'] as const;
