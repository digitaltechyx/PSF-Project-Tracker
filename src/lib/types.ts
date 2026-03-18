export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'todo' | 'in_progress' | 'done';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  color: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
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
  dueDate?: string;
  assigneeUserId?: string;
  tags?: string[];
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
