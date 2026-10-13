
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
  /**
   * Shared company timezone (IANA), e.g. Asia/Karachi.
   * Used for attendance day boundaries and company clock.
   */
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

/** Target / sub-target status. Legacy `done` may still exist in older docs. */
export type TargetStatus = 'planned' | 'in_progress' | 'hold' | 'complete' | 'cancelled' | 'done';

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
  /** @deprecated legacy collaborator share */
  sharedWithUserIds?: string[];
  /** @deprecated legacy live-edit share link */
  shareEnabled?: boolean;
  shareToken?: string | null;
  /** Set when this target was received as a copy from someone else */
  copiedFromTransferId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Snapshot of a target packaged for copy-share (not live co-edit). */
export interface TargetSnapshot {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: TargetStatus;
  subTargets: SubTarget[];
}

export interface TargetTransferAcceptance {
  userId: string;
  workspaceId: string;
  acceptedAt: string;
}

/**
 * Copy-share package at /share/t/[token].
 * Recipient accepts → targets are copied into a workspace they choose.
 */
export interface TargetTransfer {
  id: string; // token in URL
  fromUserId: string;
  fromUserName: string;
  fromWorkspaceId: string;
  fromWorkspaceName: string;
  /** Optional directed member */
  toUserId: string | null;
  toUserName: string | null;
  toEmail: string | null;
  targets: TargetSnapshot[];
  acceptances: TargetTransferAcceptance[];
  createdAt: string;
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
  /** Sum of checkout time logs (ms). */
  totalLoggedMs?: number;
  createdAt: string;
  updatedAt: string;
}

export type TaskAuditKind = 'created' | 'field_change' | 'time_logged';

/** Change / activity history for a task. */
export interface TaskAudit {
  id: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  kind: TaskAuditKind;
  actorUserId: string;
  actorName: string;
  field?: string;
  fromValue?: string | null;
  toValue?: string | null;
  /** Required for major field changes (status, priority, due date, assignees). */
  reason?: string | null;
  message?: string;
  durationMs?: number;
  createdAt: string;
}

/** Time spent on a task (usually logged at check-out). */
export interface TaskTimeLog {
  id: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  userId: string;
  userName: string;
  description: string;
  durationMs: number;
  dateKey: string;
  attendanceId?: string | null;
  createdAt: string;
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
  | 'subtask_assigned'
  | 'chat_mention'
  | 'chat_dm';

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
  channelId?: string;
  dmId?: string;
  createdAt: string;
}

export interface ChatAttachment {
  name: string;
  url: string;
  contentType: string;
  size: number;
}

export interface ChatChannel {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  /** false = all workspace members; true = only memberUserIds */
  isPrivate: boolean;
  memberUserIds: string[];
  createdByUserId: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatDm {
  id: string;
  workspaceId: string;
  participantUserIds: [string, string];
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  workspaceId: string;
  conversationType: 'channel' | 'dm';
  channelId?: string | null;
  dmId?: string | null;
  authorUserId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  body: string;
  mentionUserIds: string[];
  attachments: ChatAttachment[];
  createdAt: string;
  updatedAt: string;
}

export type GoogleDocKind = 'document' | 'spreadsheet' | 'presentation' | 'unknown';

/** Linked Google Doc/Sheet shown in-app on the Docs page. */
export interface WorkspaceDoc {
  id: string;
  workspaceId: string;
  title: string;
  kind: GoogleDocKind;
  /** Original Google URL the user pasted */
  url: string;
  /** Extracted Google file id */
  fileId: string;
  /** iframe embed URL for in-app viewing */
  embedUrl: string;
  createdByUserId: string;
  createdByName: string;
  /** Empty = visible to all workspace members; otherwise only these users (+ creator/admins). */
  sharedWithUserIds: string[];
  createdAt: string;
  updatedAt: string;
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
