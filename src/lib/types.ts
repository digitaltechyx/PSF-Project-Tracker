
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
/** Built-in defaults; projects may define custom pipeline status ids. */
export type Status = string;

export interface Pipeline {
  id: string;
  name: string;
  color?: string;
  /** closed statuses count as completed for progress / checkboxes */
  category?: 'open' | 'closed';
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  updatedAt?: string;
  lastActiveWorkspaceId?: string | null;
  preferredProjectView?: 'list' | 'board' | 'calendar' | null;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  color: string;
  ownerUserId: string;
  memberRoles: Record<string, 'owner' | 'lead' | 'member'>;
  /** Members (non-admin) allowed to open the Targets page. Admins always have access. */
  targetsAllowedUserIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export type TargetStatus = 'planned' | 'in_progress' | 'done';

export interface SubTarget {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: TargetStatus;
}

export interface Target {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: TargetStatus;
  subTargets: SubTarget[];
  createdByUserId: string;
  shareEnabled: boolean;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Public snapshot used by /share/t/[token] (anyone with the link). */
export interface TargetShare {
  id: string; // same as shareToken
  workspaceId: string;
  targetId: string;
  workspaceName: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: TargetStatus;
  subTargets: SubTarget[];
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
  allowedUserIds?: string[];
  /** Custom board columns / statuses (ClickUp-style). Falls back to defaults when empty. */
  pipelines?: Pipeline[];
  /** The user who created the project (used to mark them as project admin in UI). */
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate?: string | null;
  assigneeUserIds?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  title: string;
  status: Status;
  priority: Priority;
  dueDate?: string | null;
  assigneeUserIds?: string[];
  createdAt: string;
  updatedAt: string;
}


export interface Comment {
  id: string;
  taskId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  role: 'member' | 'lead';
  invitedBy: string;
  invitedByName: string;
  type: 'link' | 'direct' | 'email';
  status: 'active' | 'accepted' | 'expired' | 'cancelled';
  usageCount: number;
  maxUses: number | 'unlimited';
  targetProjectIds?: string[];
  createdAt: string;
  expiresAt: string | null;
  /** When set (email invites), only this address may accept the invitation. */
  invitedEmail?: string | null;
}

export type NotificationType = 
  | 'task_assigned' 
  | 'task_unassigned' 
  | 'task_updated' 
  | 'task_status_changed' 
  | 'comment_added'
  | 'subtask_assigned';

export interface Notification {
  id: string;
  userId: string;
  actorId: string;
  actorName: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
  createdAt: string;
}

export interface AttendanceBreak {
  startTime: string;
  endTime?: string | null;
}

export interface AttendanceEntry {
  /** Document ID: `{userId}_{dateKey}` */
  id: string;
  workspaceId: string;
  userId: string;
  dateKey: string; // YYYY-MM-DD (local)
  checkInTime: string; // ISO timestamp
  checkOutTime: string | null; // ISO timestamp, null until checkout
  /** Break segments for the day (open break has no endTime). */
  breaks?: AttendanceBreak[];
  /** Cached total break ms (optional, updated on check-out). */
  totalBreakMs?: number;
  createdAt: string;
  updatedAt: string;
}
