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
  where, 
  doc, 
  collectionGroup
} from 'firebase/firestore';
import { Workspace, Project, Task, WorkspaceMember, Notification } from '@/lib/types';

export function useNexusStore() {
  const { user } = useUser();
  const db = useFirestore();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // 1. Fetch Workspaces where user is a member
  const workspacesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'workspaces'),
      where(`memberRoles.${user.uid}`, 'in', ['owner', 'admin', 'member'])
    );
  }, [db, user]);
  
  const { data: workspacesData } = useCollection<Workspace>(workspacesQuery);
  const workspaces = useMemo(() => workspacesData || [], [workspacesData]);

  const activeWorkspace = useMemo(() => {
    if (workspaces.length === 0) return null;
    if (activeWorkspaceId) {
      return workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
    }
    return workspaces[0];
  }, [workspaces, activeWorkspaceId]);

  // Set initial workspace if none selected
  useEffect(() => {
    if (activeWorkspace && !activeWorkspaceId) {
      setActiveWorkspaceId(activeWorkspace.id);
    }
  }, [activeWorkspace, activeWorkspaceId]);

  // 2. Fetch Projects for active workspace
  const projectsQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspace || !user) return null;
    return query(
      collection(db, 'workspaces', activeWorkspace.id, 'projects'),
      where(`memberRoles.${user.uid}`, 'in', ['owner', 'admin', 'member'])
    );
  }, [db, activeWorkspace, user]);
  
  const { data: projectsData } = useCollection<Project>(projectsQuery);
  const projects = useMemo(() => projectsData || [], [projectsData]);

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  // 3. Fetch Tasks (Collection Group for workspace-wide view)
  const tasksQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspace || !user) return null;
    return query(
      collectionGroup(db, 'tasks'),
      where('workspaceId', '==', activeWorkspace.id),
      where(`memberRoles.${user.uid}`, 'in', ['owner', 'admin', 'member'])
    );
  }, [db, activeWorkspace, user]);
  
  const { data: tasksData } = useCollection<Task>(tasksQuery);
  const tasks = useMemo(() => tasksData || [], [tasksData]);

  // 4. Fetch Members for active workspace
  const membersQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspace || !user) return null;
    return query(
      collection(db, 'workspaces', activeWorkspace.id, 'members'),
      where(`memberRoles.${user.uid}`, 'in', ['owner', 'admin', 'member'])
    );
  }, [db, activeWorkspace, user]);
  
  const { data: membersData } = useCollection<WorkspaceMember>(membersQuery);
  const members = useMemo(() => membersData || [], [membersData]);

  // Filter Logic
  const filterTasks = useCallback((taskList: Task[], queryStr: string) => {
    if (!queryStr) return taskList;
    const lowerQuery = queryStr.toLowerCase();
    return taskList.filter(t => 
      t.title.toLowerCase().includes(lowerQuery) ||
      (t.description && t.description.toLowerCase().includes(lowerQuery)) ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
    );
  }, []);

  const workspaceTasks = useMemo(() => 
    filterTasks(tasks, globalSearchQuery),
    [tasks, globalSearchQuery, filterTasks]
  );

  const projectTasks = useMemo(() => {
    const pTasks = activeProjectId ? tasks.filter(t => t.projectId === activeProjectId) : [];
    return filterTasks(pTasks, globalSearchQuery);
  }, [tasks, activeProjectId, globalSearchQuery, filterTasks]);

  const myTasks = useMemo(() => {
    if (!user) return [];
    const mTasks = tasks.filter(t => t.assigneeUserId === user.uid);
    return filterTasks(mTasks, globalSearchQuery);
  }, [tasks, user, globalSearchQuery, filterTasks]);

  const workspaceMembers = useMemo(() => members, [members]);

  const workspaceNotifications: Notification[] = [];

  const switchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    setActiveProjectId(null); 
    setGlobalSearchQuery('');
  }, []);

  const selectProject = useCallback((id: string | null) => {
    setActiveProjectId(id);
  }, []);

  const createWorkspace = useCallback((name: string, description: string) => {
    if (!db || !user) return;
    const wsRef = doc(collection(db, 'workspaces'));
    const memberRoles = { [user.uid]: 'owner' as const };
    
    const wsData: Workspace = {
      id: wsRef.id,
      name,
      description,
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      ownerUserId: user.uid,
      memberRoles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocumentNonBlocking(wsRef, wsData, { merge: true });

    const memberRef = doc(db, 'workspaces', wsRef.id, 'members', user.uid);
    setDocumentNonBlocking(memberRef, {
      id: user.uid,
      workspaceId: wsRef.id,
      userId: user.uid,
      displayName: user.displayName || 'Anonymous',
      email: user.email || '',
      avatarUrl: user.photoURL || '',
      memberRoles
    }, { merge: true });

    setActiveWorkspaceId(wsRef.id);
  }, [db, user]);

  const createProject = useCallback((name: string, description: string) => {
    if (!db || !activeWorkspace || !user) return;
    const projRef = doc(collection(db, 'workspaces', activeWorkspace.id, 'projects'));
    const memberRoles = activeWorkspace.memberRoles || { [user.uid]: 'owner' as const };
    
    const projData: Project = {
      id: projRef.id,
      workspaceId: activeWorkspace.id,
      name,
      description,
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      memberRoles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocumentNonBlocking(projRef, projData, { merge: true });
  }, [db, activeWorkspace, user]);

  const createTask = useCallback((projectId: string, taskData: Partial<Task>) => {
    if (!db || !activeWorkspace || !user) return;
    const taskRef = doc(collection(db, 'workspaces', activeWorkspace.id, 'projects', projectId, 'tasks'));
    const memberRoles = activeWorkspace.memberRoles || { [user.uid]: 'owner' as const };
    
    const newTask: Task = {
      id: taskRef.id,
      workspaceId: activeWorkspace.id,
      projectId,
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      dueDate: taskData.dueDate || undefined,
      assigneeUserId: taskData.assigneeUserId || undefined,
      tags: taskData.tags || [],
      memberRoles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocumentNonBlocking(taskRef, newTask, { merge: true });
  }, [db, activeWorkspace, user]);

  const updateTask = useCallback((taskId: string, data: Partial<Task>) => {
    if (!db || !activeWorkspace) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const taskRef = doc(db, 'workspaces', activeWorkspace.id, 'projects', task.projectId, 'tasks', taskId);
    updateDocumentNonBlocking(taskRef, { ...data, updatedAt: new Date().toISOString() });
  }, [db, activeWorkspace, tasks]);

  const deleteTask = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!db || !activeWorkspace || !task) return;
    const taskRef = doc(db, 'workspaces', activeWorkspace.id, 'projects', task.projectId, 'tasks', taskId);
    deleteDocumentNonBlocking(taskRef);
  }, [db, activeWorkspace, tasks]);

  const addMockMember = useCallback((name: string, email: string) => {
    if (!db || !activeWorkspace || !user) return;
    const tempId = Math.random().toString(36).substring(7);
    const memberRef = doc(db, 'workspaces', activeWorkspace.id, 'members', tempId);
    const memberRoles = activeWorkspace.memberRoles || { [user.uid]: 'owner' as const };
    
    setDocumentNonBlocking(memberRef, {
      id: tempId,
      workspaceId: activeWorkspace.id,
      userId: tempId,
      displayName: name,
      email,
      avatarUrl: `https://picsum.photos/seed/${tempId}/100/100`,
      memberRoles
    }, { merge: true });
  }, [db, activeWorkspace, user]);

  const removeMember = useCallback((memberId: string) => {
    if (!db || !activeWorkspace) return;
    const memberRef = doc(db, 'workspaces', activeWorkspace.id, 'members', memberId);
    deleteDocumentNonBlocking(memberRef);
  }, [db, activeWorkspace]);

  const addComment = useCallback((taskId: string, body: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!db || !activeWorkspace || !task || !user) return;
    const commentRef = doc(collection(db, 'workspaces', activeWorkspace.id, 'projects', task.projectId, 'tasks', taskId, 'comments'));
    const memberRoles = activeWorkspace.memberRoles || { [user.uid]: 'owner' as const };
    
    setDocumentNonBlocking(commentRef, {
      id: commentRef.id,
      taskId,
      authorUserId: user.uid,
      body,
      memberRoles,
      createdAt: new Date().toISOString(),
    }, { merge: true });
  }, [db, activeWorkspace, tasks, user]);

  return {
    currentUser: user ? { id: user.uid, name: user.displayName || 'User', email: user.email || '', avatarUrl: user.photoURL || '' } : null,
    workspaces,
    activeWorkspace: activeWorkspace || { name: 'Loading...', color: '#ccc', memberRoles: {} },
    workspaceProjects: projects,
    activeProject,
    tasks,
    workspaceTasks,
    projectTasks,
    myTasks,
    workspaceMembers: members,
    workspaceNotifications,
    globalSearchQuery,
    setGlobalSearchQuery,
    switchWorkspace,
    selectProject,
    createWorkspace,
    createProject,
    createTask,
    updateTask,
    deleteTask,
    addMockMember,
    removeMember,
    addComment,
  };
}
