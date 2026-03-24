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
import { Workspace, Project, Task, WorkspaceMember, Status, Priority } from '@/lib/types';

export function useNexusStore() {
  const { user } = useUser();
  const db = useFirestore();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // 1. Workspaces
  const workspacesQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return query(
      collection(db, 'workspaces'),
      where(`memberRoles.${user.uid}`, 'in', ['owner', 'admin', 'member'])
    );
  }, [db, user?.uid]);
  
  const { data: workspacesData, isLoading: isWorkspacesLoading } = useCollection<Workspace>(workspacesQuery);
  const workspaces = useMemo(() => workspacesData || [], [workspacesData]);

  const activeWorkspace = useMemo(() => {
    if (workspaces.length === 0) return null;
    if (activeWorkspaceId) {
      return workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
    }
    return workspaces[0];
  }, [workspaces, activeWorkspaceId]);

  useEffect(() => {
    if (activeWorkspace && !activeWorkspaceId) {
      setActiveWorkspaceId(activeWorkspace.id);
    }
  }, [activeWorkspace, activeWorkspaceId]);

  // 2. Projects
  const projectsQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspace?.id) return null;
    return query(collection(db, 'workspaces', activeWorkspace.id, 'projects'));
  }, [db, activeWorkspace?.id]);
  
  const { data: projectsData, isLoading: isProjectsLoading } = useCollection<Project>(projectsQuery);
  const projects = useMemo(() => projectsData || [], [projectsData]);

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  // 3. Global Tasks (Collection Group)
  const globalTasksQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspace?.id || !user?.uid) return null;
    // Simplified query to avoid complex indexing requirements
    return query(
      collectionGroup(db, 'tasks'),
      where('workspaceId', '==', activeWorkspace.id)
    );
  }, [db, activeWorkspace?.id, user?.uid]);
  
  const { data: globalTasksData, isLoading: isTasksLoading } = useCollection<Task>(globalTasksQuery);
  const rawGlobalTasks = useMemo(() => globalTasksData || [], [globalTasksData]);

  // 4. Project-Specific Tasks (Direct Collection)
  const activeProjectTasksQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspace?.id || !activeProjectId) return null;
    return query(
      collection(db, 'workspaces', activeWorkspace.id, 'projects', activeProjectId, 'tasks')
    );
  }, [db, activeWorkspace?.id, activeProjectId]);

  const { data: activeProjectTasksData } = useCollection<Task>(activeProjectTasksQuery);
  const rawProjectTasks = useMemo(() => activeProjectTasksData || [], [activeProjectTasksData]);

  // 5. Members
  const membersQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspace?.id) return null;
    return query(collection(db, 'workspaces', activeWorkspace.id, 'members'));
  }, [db, activeWorkspace?.id]);
  
  const { data: membersData } = useCollection<WorkspaceMember>(membersQuery);
  const members = useMemo(() => membersData || [], [membersData]);

  const filterTasks = useCallback((taskList: Task[], queryStr: string) => {
    if (!queryStr) return taskList;
    const lowerQuery = queryStr.toLowerCase();
    return taskList.filter(t => 
      t.title.toLowerCase().includes(lowerQuery) ||
      (t.description && t.description.toLowerCase().includes(lowerQuery)) ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
    );
  }, []);

  // Filtered views for search results
  const workspaceTasks = useMemo(() => 
    filterTasks(rawGlobalTasks, globalSearchQuery),
    [rawGlobalTasks, globalSearchQuery, filterTasks]
  );

  const projectTasks = useMemo(() => 
    filterTasks(rawProjectTasks, globalSearchQuery),
    [rawProjectTasks, globalSearchQuery, filterTasks]
  );

  // My Tasks - Directly derived from workspace-level task stream
  const myTasks = useMemo(() => {
    if (!user?.uid) return [];
    const assigned = rawGlobalTasks.filter(t => t.assigneeUserId === user.uid);
    return filterTasks(assigned, globalSearchQuery);
  }, [rawGlobalTasks, user?.uid, globalSearchQuery, filterTasks]);

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
      description: description || '',
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
      avatarUrl: user.photoURL || null,
    }, { merge: true });

    setActiveWorkspaceId(wsRef.id);
  }, [db, user]);

  const createProject = useCallback((name: string, description: string) => {
    if (!db || !activeWorkspace?.id || !user) return;
    const projRef = doc(collection(db, 'workspaces', activeWorkspace.id, 'projects'));
    
    const projData: Project = {
      id: projRef.id,
      workspaceId: activeWorkspace.id,
      name,
      description: description || '',
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      memberRoles: activeWorkspace.memberRoles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocumentNonBlocking(projRef, projData, { merge: true });
  }, [db, activeWorkspace, user]);

  const createTask = useCallback((projectId: string, taskData: Partial<Task>) => {
    if (!db || !activeWorkspace?.id || !user) return;
    
    const roles = activeWorkspace.memberRoles && Object.keys(activeWorkspace.memberRoles).length > 0 
      ? activeWorkspace.memberRoles 
      : { [user.uid]: 'owner' as const };

    const taskRef = doc(collection(db, 'workspaces', activeWorkspace.id, 'projects', projectId, 'tasks'));
    
    const newTask: Task = {
      id: taskRef.id,
      workspaceId: activeWorkspace.id,
      projectId,
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      dueDate: taskData.dueDate || null,
      assigneeUserId: taskData.assigneeUserId || null,
      tags: taskData.tags || [],
      memberRoles: roles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocumentNonBlocking(taskRef, newTask, { merge: true });
  }, [db, activeWorkspace, user]);

  const updateTask = useCallback((taskId: string, data: Partial<Task>) => {
    if (!db) return;
    const task = rawGlobalTasks.find(t => t.id === taskId) || rawProjectTasks.find(t => t.id === taskId);
    if (!task) return;
    
    const taskRef = doc(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', taskId);
    updateDocumentNonBlocking(taskRef, { 
      ...data, 
      updatedAt: new Date().toISOString() 
    });
  }, [db, rawGlobalTasks, rawProjectTasks]);

  const deleteTask = useCallback((taskId: string) => {
    const task = rawGlobalTasks.find(t => t.id === taskId) || rawProjectTasks.find(t => t.id === taskId);
    if (!db || !task) return;
    const taskRef = doc(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', taskId);
    deleteDocumentNonBlocking(taskRef);
  }, [db, rawGlobalTasks, rawProjectTasks]);

  const addMockMember = useCallback((name: string, email: string) => {
    if (!db || !activeWorkspace?.id || !user) return;
    const tempId = Math.random().toString(36).substring(7);
    const memberRef = doc(db, 'workspaces', activeWorkspace.id, 'members', tempId);
    
    setDocumentNonBlocking(memberRef, {
      id: tempId,
      workspaceId: activeWorkspace.id,
      userId: tempId,
      displayName: name,
      email,
      avatarUrl: `https://picsum.photos/seed/${tempId}/100/100`,
    }, { merge: true });
  }, [db, activeWorkspace, user]);

  const removeMember = useCallback((memberId: string) => {
    if (!db || !activeWorkspace?.id) return;
    const memberRef = doc(db, 'workspaces', activeWorkspace.id, 'members', memberId);
    deleteDocumentNonBlocking(memberRef);
  }, [db, activeWorkspace]);

  const addComment = useCallback((taskId: string, body: string) => {
    const task = rawGlobalTasks.find(t => t.id === taskId) || rawProjectTasks.find(t => t.id === taskId);
    if (!db || !task || !user) return;
    const commentRef = doc(collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', taskId, 'comments'));
    
    setDocumentNonBlocking(commentRef, {
      id: commentRef.id,
      taskId,
      authorUserId: user.uid,
      workspaceId: task.workspaceId,
      body,
      memberRoles: task.memberRoles,
      createdAt: new Date().toISOString(),
    }, { merge: true });
  }, [db, rawGlobalTasks, rawProjectTasks, user]);

  return {
    currentUser: user ? { id: user.uid, name: user.displayName || 'User', email: user.email || '', avatarUrl: user.photoURL || null } : null,
    workspaces,
    activeWorkspace: activeWorkspace || { name: 'Loading...', color: '#ccc', memberRoles: {} },
    workspaceProjects: projects,
    activeProject,
    workspaceTasks, 
    allWorkspaceTasks: rawGlobalTasks,
    projectTasks,
    myTasks,
    tasks: rawGlobalTasks, 
    workspaceMembers: members,
    workspaceNotifications: [],
    globalSearchQuery,
    isTasksLoading,
    isProjectsLoading,
    isWorkspacesLoading,
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