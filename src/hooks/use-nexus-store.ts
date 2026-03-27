"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { 
  collection, 
  query, 
  doc, 
  collectionGroup,
  where,
  getDocs,
  limit,
  getDoc
} from 'firebase/firestore';
import { Workspace, Project, Task, WorkspaceMember, User, Invitation } from '@/lib/types';

export function useNexusStore() {
  const { user } = useUser();
  const db = useFirestore();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // 1. Fetch all workspaces the user has access to
  const workspacesQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return query(collection(db, 'workspaces'));
  }, [db, user?.uid]);
  
  const { data: workspacesData, isLoading: isWorkspacesLoading } = useCollection<Workspace>(workspacesQuery);
  
  const workspaces = useMemo(() => {
    if (!workspacesData || !user?.uid) return [];
    return workspacesData.filter(w => 
      w.ownerUserId === user.uid || (w.memberRoles && w.memberRoles[user.uid])
    );
  }, [workspacesData, user?.uid]);

  const activeWorkspace = useMemo(() => {
    if (workspaces.length === 0) return null;
    if (activeWorkspaceId) {
      const found = workspaces.find(w => w.id === activeWorkspaceId);
      return found || workspaces[0];
    }
    return workspaces[0];
  }, [workspaces, activeWorkspaceId]);

  useEffect(() => {
    if (activeWorkspace && activeWorkspace.id !== activeWorkspaceId) {
      setActiveWorkspaceId(activeWorkspace.id);
    }
  }, [activeWorkspace, activeWorkspaceId]);

  const isOwner = useMemo(() => activeWorkspace?.ownerUserId === user?.uid, [activeWorkspace, user?.uid]);
  const currentRole = useMemo(() => {
    if (isOwner) return 'owner';
    return activeWorkspace?.memberRoles?.[user?.uid || ''] || null;
  }, [activeWorkspace, user?.uid, isOwner]);

  const isAdmin = useMemo(() => isOwner || currentRole === 'lead' || currentRole === 'owner', [isOwner, currentRole]);

  // 2. Fetch projects for the active workspace
  const projectsQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId) return null;
    const isVerified = workspaces.some(w => w.id === wsId);
    if (!isVerified) return null;
    return query(collection(db, 'workspaces', wsId, 'projects'));
  }, [db, user?.uid, activeWorkspace?.id, workspaces]);
  
  const { data: projectsData, isLoading: isProjectsLoading } = useCollection<Project>(projectsQuery);
  
  // Scoped project list: Admins see everything, Members only see allowed projects
  const projects = useMemo(() => {
    if (!projectsData) return [];
    if (isAdmin) return projectsData;
    return projectsData.filter(p => p.allowedUserIds?.includes(user?.uid || ''));
  }, [projectsData, isAdmin, user?.uid]);

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  // 3. Fetch tasks
  const globalTasksQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return query(collectionGroup(db, 'tasks'));
  }, [db, user?.uid]);
  
  const { data: globalTasksData, isLoading: isTasksLoading } = useCollection<Task>(globalTasksQuery);
  
  const allWorkspaceTasks = useMemo(() => {
    const wsId = activeWorkspace?.id;
    if (!globalTasksData || !wsId) return [];
    
    // Filter tasks based on project visibility
    return globalTasksData.filter(t => {
      if (t.workspaceId !== wsId) return false;
      if (isAdmin) return true;
      const project = projects.find(p => p.id === t.projectId);
      return !!project;
    });
  }, [globalTasksData, activeWorkspace?.id, isAdmin, projects]);

  const myTasks = useMemo(() => {
    if (!user?.uid) return [];
    let tasks = allWorkspaceTasks.filter(t => t.assigneeUserId === user.uid);
    if (!globalSearchQuery) return tasks;
    const lowerQuery = globalSearchQuery.toLowerCase();
    return tasks.filter(t => 
      t.title.toLowerCase().includes(lowerQuery) ||
      (t.description && t.description.toLowerCase().includes(lowerQuery))
    );
  }, [allWorkspaceTasks, user?.uid, globalSearchQuery]);

  const projectTasks = useMemo(() => {
    if (!activeProject) return [];
    const tasks = allWorkspaceTasks.filter(t => t.projectId === activeProject.id);
    if (!globalSearchQuery) return tasks;
    const lowerQuery = globalSearchQuery.toLowerCase();
    return tasks.filter(t => 
      t.title.toLowerCase().includes(lowerQuery) ||
      (t.description && t.description.toLowerCase().includes(lowerQuery))
    );
  }, [allWorkspaceTasks, activeProject, globalSearchQuery]);

  // 4. Members
  const membersQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId) return null;
    return query(collection(db, 'workspaces', wsId, 'members'));
  }, [db, user?.uid, activeWorkspace?.id]);
  
  const { data: membersData } = useCollection<WorkspaceMember>(membersQuery);
  const profiles = useMemo(() => membersData || [], [membersData]);

  const workspaceMembers = useMemo(() => {
    if (!activeWorkspace) return [];
    const roles = activeWorkspace.memberRoles || {};
    return Object.entries(roles).map(([uid, role]) => {
      const profile = profiles.find(p => p.userId === uid || p.id === uid);
      const isMe = uid === user?.uid;
      return {
        id: uid,
        userId: uid,
        role: role as any,
        displayName: profile?.displayName || (isMe ? user.displayName : 'Pending Sync...'),
        email: profile?.email || (isMe ? user.email : ''),
        avatarUrl: profile?.avatarUrl || (isMe ? user.photoURL : null),
      };
    });
  }, [activeWorkspace, profiles, user]);

  const switchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    setActiveProjectId(null); 
    setGlobalSearchQuery('');
  }, []);

  const selectProject = useCallback((id: string | null) => {
    setActiveProjectId(id);
  }, []);

  const createWorkspace = useCallback(async (name: string, description: string) => {
    if (!db || !user) return null;
    const wsRef = doc(collection(db, 'workspaces'));
    const wsData: Workspace = {
      id: wsRef.id,
      name,
      description: description || '',
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      ownerUserId: user.uid,
      memberRoles: { [user.uid]: 'owner' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(wsRef, wsData, { merge: true });
    
    const memberRef = doc(db, 'workspaces', wsRef.id, 'members', user.uid);
    setDocumentNonBlocking(memberRef, {
      id: user.uid,
      workspaceId: wsRef.id,
      userId: user.uid,
      displayName: user.displayName || 'User',
      email: user.email?.toLowerCase() || '',
      avatarUrl: user.photoURL || null,
    }, { merge: true });
    
    return wsRef.id;
  }, [db, user]);

  const createInviteLink = useCallback((options: { role: 'member' | 'lead', expiresDays: number | 'never', maxUses: number | 'unlimited', targetProjectIds?: string[] }) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !isOwner) return;
    
    const inviteRef = doc(collection(db, 'invitations'));
    const expiresAt = options.expiresDays === 'never' ? null : new Date(Date.now() + options.expiresDays * 24 * 60 * 60 * 1000).toISOString();
    
    const inviteData: Invitation = {
      id: inviteRef.id,
      workspaceId: wsId,
      workspaceName: activeWorkspace?.name || 'Workspace',
      role: options.role,
      invitedBy: user!.uid,
      invitedByName: user!.displayName || 'User',
      type: 'link',
      status: 'active',
      usageCount: 0,
      maxUses: options.maxUses,
      targetProjectIds: options.targetProjectIds || [],
      createdAt: new Date().toISOString(),
      expiresAt,
    };
    setDocumentNonBlocking(inviteRef, inviteData, { merge: true });
    return inviteRef.id;
  }, [db, activeWorkspace, isOwner, user]);

  const createProject = useCallback((wsId: string, name: string, description: string) => {
    if (!db || !wsId) return null;
    const projRef = doc(collection(db, 'workspaces', wsId, 'projects'));
    const projData: Project = {
      id: projRef.id,
      workspaceId: wsId,
      name,
      description: description || '',
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      allowedUserIds: [user?.uid || ''], // Creator always has access
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(projRef, projData, { merge: true });
    return projRef.id;
  }, [db, user?.uid]);

  const updateProjectMembers = useCallback((projectId: string, allowedUserIds: string[]) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !projectId || !isAdmin) return;
    const ref = doc(db, 'workspaces', wsId, 'projects', projectId);
    updateDocumentNonBlocking(ref, { allowedUserIds, updatedAt: new Date().toISOString() });
  }, [db, activeWorkspace?.id, isAdmin]);

  const createTask = useCallback((wsId: string, projectId: string, data: any) => {
    if (!db || !wsId || !projectId) return null;
    const taskRef = doc(collection(db, 'workspaces', wsId, 'projects', projectId, 'tasks'));
    const taskData = {
      id: taskRef.id,
      workspaceId: wsId,
      projectId,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(taskRef, taskData, { merge: true });
    return taskRef.id;
  }, [db]);

  return {
    currentUser: user ? { id: user.uid, name: user.displayName || 'User', email: user.email || '', avatarUrl: user.photoURL || null } : null,
    workspaces,
    activeWorkspace: activeWorkspace || { id: '', name: 'Loading...', color: '#ccc', memberRoles: {}, ownerUserId: '' },
    workspaceProjects: projects,
    activeProject,
    allWorkspaceTasks,
    projectTasks,
    myTasks,
    workspaceMembers,
    workspaceNotifications: [],
    globalSearchQuery,
    isTasksLoading,
    isProjectsLoading,
    isWorkspacesLoading,
    isAdmin,
    isOwner,
    currentRole,
    setGlobalSearchQuery,
    switchWorkspace,
    selectProject,
    createWorkspace,
    createProject,
    updateProjectMembers,
    createTask,
    createInviteLink,
    updateTask: (taskId: string, data: Partial<Task>) => {
      if (!db || !isAdmin) return;
      const t = allWorkspaceTasks.find(x => x.id === taskId);
      if (t) {
        const ref = doc(db, 'workspaces', t.workspaceId, 'projects', t.projectId, 'tasks', t.id);
        updateDocumentNonBlocking(ref, { ...data, updatedAt: new Date().toISOString() });
      }
    },
    deleteTask: (taskId: string) => {
      if (!db || !isAdmin) return;
      const t = allWorkspaceTasks.find(x => x.id === taskId);
      if (t) {
        const ref = doc(db, 'workspaces', t.workspaceId, 'projects', t.projectId, 'tasks', t.id);
        deleteDocumentNonBlocking(ref);
      }
    }
  };
}
