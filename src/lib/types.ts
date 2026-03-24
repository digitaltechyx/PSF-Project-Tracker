export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'todo' | 'in_progress' | 'done';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  updatedAt?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  color: string;
  ownerUserId: string;
  memberRoles: Record<string, 'owner' | 'admin' | 'member'>;
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
  memberRoles?: Record<string, 'owner' | 'admin' | 'member'>;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
  memberRoles: Record<string, 'owner' | 'admin' | 'member'>;
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
  assigneeUserId?: string | null;
  tags?: string[];
  memberRoles: Record<string, 'owner' | 'admin' | 'member'>;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorUserId: string;
  body: string;
  memberRoles: Record<string, 'owner' | 'admin' | 'member'>;
  createdAt: string;
}

export interface Notification {
  id: string;
  workspaceId: string;
  type: 'comment' | 'status' | 'assignment' | 'invite';
  user: {
    name: string;
    avatar: string;
  };
  message: string;
  content?: string;
  time: string;
  read: boolean;
}
