import { User, Workspace, WorkspaceMember, Project, Task, Status, Priority } from './types';

export const currentUser: User = {
  id: 'u1',
  name: 'Alex Rivera',
  email: 'alex@nexustrack.io',
  avatarUrl: 'https://picsum.photos/seed/u1/100/100',
};

export const mockUsers: User[] = [
  currentUser,
  { id: 'u2', name: 'Jordan Smith', email: 'jordan@nexustrack.io', avatarUrl: 'https://picsum.photos/seed/u2/100/100' },
  { id: 'u3', name: 'Sarah Chen', email: 'sarah@nexustrack.io', avatarUrl: 'https://picsum.photos/seed/u3/100/100' },
];

export const mockWorkspaces: Workspace[] = [
  {
    id: 'w1',
    name: 'Product Design',
    description: 'Workspace for the core product design team.',
    color: '#452ED2',
    ownerUserId: 'u1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'w2',
    name: 'Marketing Ops',
    description: 'Marketing campaigns and social media management.',
    color: '#66A9F0',
    ownerUserId: 'u1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockWorkspaceMembers: WorkspaceMember[] = [
  { id: 'wm1', workspaceId: 'w1', userId: 'u1', displayName: 'Alex Rivera', email: 'alex@nexustrack.io', avatarUrl: 'https://picsum.photos/seed/u1/100/100' },
  { id: 'wm2', workspaceId: 'w1', userId: 'u2', displayName: 'Jordan Smith', email: 'jordan@nexustrack.io', avatarUrl: 'https://picsum.photos/seed/u2/100/100' },
  { id: 'wm3', workspaceId: 'w2', userId: 'u1', displayName: 'Alex Rivera', email: 'alex@nexustrack.io', avatarUrl: 'https://picsum.photos/seed/u1/100/100' },
  { id: 'wm4', workspaceId: 'w2', userId: 'u3', displayName: 'Sarah Chen', email: 'sarah@nexustrack.io', avatarUrl: 'https://picsum.photos/seed/u3/100/100' },
];

export const mockProjects: Project[] = [
  {
    id: 'p1',
    workspaceId: 'w1',
    name: 'Mobile App Redesign',
    description: 'Revamping the core mobile experience.',
    color: '#452ED2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p2',
    workspaceId: 'w1',
    name: 'Design System',
    description: 'Unified components for all platforms.',
    color: '#FF7F50',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockTasks: Task[] = [
  {
    id: 't1',
    workspaceId: 'w1',
    projectId: 'p1',
    title: 'Finalize navigation patterns',
    description: 'Decide between tab bar and drawer for secondary navigation.',
    status: 'in_progress',
    priority: 'high',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    assigneeUserId: 'u2',
    tags: ['UX', 'Phase 1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't2',
    workspaceId: 'w1',
    projectId: 'p1',
    title: 'Research dark mode colors',
    description: 'Check accessibility contrast for the new palette.',
    status: 'todo',
    priority: 'medium',
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    assigneeUserId: 'u1',
    tags: ['UI', 'A11y'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't3',
    workspaceId: 'w1',
    projectId: 'p1',
    title: 'User testing setup',
    description: 'Recruit 5 participants for the first round of testing.',
    status: 'done',
    priority: 'low',
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
    assigneeUserId: 'u1',
    tags: ['Research'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];