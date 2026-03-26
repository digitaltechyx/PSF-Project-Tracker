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
  limit
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

  // 2. Identify the active workspace from the FILTERED list
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

  // Role Checks
  const isOwner = useMemo(() => activeWorkspace?.ownerUserId === user?.uid, [activeWorkspace, user?.uid]);
  const currentRole = useMemo(() => {
    if (isOwner) return 'owner';
    return activeWorkspace?.memberRoles?.[user?.uid || ''] || null;
  }, [activeWorkspace, user?.uid, isOwner]);

  const isAdmin = useMemo(() => isOwner || currentRole === 'lead' || currentRole === 'owner', [isOwner, currentRole]);
  const isMemberOnly = useMemo(() => !isAdmin && currentRole === 'member', [isAdmin, currentRole]);

  // 3. Fetch projects for the active workspace - GATED BY ACTUAL MEMBERSHIP
  const projectsQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId) return null;
    
    // Only query if we have verified membership in the local list
    const isVerified = workspaces.some(w => w.id === wsId);
    if (!isVerified) return null;

    return query(collection(db, 'workspaces', wsId, 'projects'));
  }, [db, user?.uid, activeWorkspace?.id, workspaces]);
  
  const { data: projectsData, isLoading: isProjectsLoading } = useCollection<Project>(projectsQuery);
  const projects = useMemo(() => projectsData || [], [projectsData]);

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  // 4. Fetch tasks - GATED BY USER
  const globalTasksQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return query(collectionGroup(db, 'tasks'));
  }, [db, user?.uid]);
  
  const { data: globalTasksData, isLoading: isTasksLoading } = useCollection<Task>(globalTasksQuery);
  
  const allWorkspaceTasks = useMemo(() => {
    const wsId = activeWorkspace?.id;
    if (!globalTasksData || !wsId) return [];
    
    const isVerified = workspaces.some(w => w.id === wsId);
    if (!isVerified) return [];

    return globalTasksData.filter(t => t.workspaceId === wsId);
  }, [globalTasksData, activeWorkspace?.id, workspaces]);

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

  // 5. Members - GATED BY ACTUAL MEMBERSHIP
  const membersQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId) return null;

    const isVerified = workspaces.some(w => w.id === wsId);
    if (!isVerified) return null;

    return query(collection(db, 'workspaces', wsId, 'members'));
  }, [db, user?.uid, activeWorkspace?.id, workspaces]);
  
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

  const searchUsersByEmail = async (queryText: string): Promise<User[]> => {
    if (!db || !queryText || queryText.trim().length < 2) return [];
    const term = queryText.trim().toLowerCase();
    try {
      const q = query(
        collection(db, 'users'), 
        where('email', '>=', term),
        where('email', '<=', term + '\uf8ff'),
        limit(5)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
    } catch (error) {
      console.error("Search failed:", error);
      return [];
    }
  };

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

  const directAddMember = useCallback((targetUser: User, role: 'member' | 'lead') => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !isOwner) return;
    
    const wsRef = doc(db, 'workspaces', wsId);
    const newRoles = { ...(activeWorkspace?.memberRoles || {}), [targetUser.id]: role };
    updateDocumentNonBlocking(wsRef, { memberRoles: newRoles });

    const memberRef = doc(db, 'workspaces', wsId, 'members', targetUser.id);
    setDocumentNonBlocking(memberRef, {
      id: targetUser.id,
      workspaceId: wsId,
      userId: targetUser.id,
      displayName: targetUser.name || 'User',
      email: targetUser.email?.toLowerCase() || '',
      avatarUrl: targetUser.avatarUrl || null,
    }, { merge: true });
  }, [db, activeWorkspace, isOwner]);

  const createInviteLink = useCallback((options: { role: 'member' | 'lead', expiresDays: number | 'never', maxUses: number | 'unlimited' }) => {
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
      createdAt: new Date().toISOString(),
      expiresAt,
    };
    setDocumentNonBlocking(inviteRef, inviteData, { merge: true });
    return inviteRef.id;
  }, [db, activeWorkspace, isOwner, user]);

  const createProject = useCallback((wsId: string, name: string, description: string) => {
    if (!db || !wsId) return null;
    const projRef = doc(collection(db, 'workspaces', wsId, 'projects'));
    const projData = {
      id: projRef.id,
      workspaceId: wsId,
      name,
      description: description || '',
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDocumentNonBlocking(projRef, projData, { merge: true });
    return projRef.id;
  }, [db]);

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
    isMemberOnly,
    currentRole,
    setGlobalSearchQuery,
    switchWorkspace,
    selectProject,
    createWorkspace,
    createProject,
    createTask,
    searchUsersByEmail,
    directAddMember,
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
    },
    removeMember: (memberId: string) => {
      const wsId = activeWorkspace?.id;
      if (!db || !wsId || !isOwner) return;
      const memberRef = doc(db, 'workspaces', wsId, 'members', memberId);
      deleteDocumentNonBlocking(memberRef);
      const currentRoles = { ...(activeWorkspace?.memberRoles || {}) };
      delete currentRoles[memberId];
      updateDocumentNonBlocking(doc(db, 'workspaces', wsId), { memberRoles: currentRoles });
    },
    addComment: (taskId: string, body: string) => {
      if (!db || !user) return;
      const t = allWorkspaceTasks.find(x => x.id === taskId);
      if (t) {
        const ref = doc(collection(db, 'workspaces', t.workspaceId, 'projects', t.projectId, 'tasks', t.id, 'comments'));
        setDocumentNonBlocking(ref, {
          id: ref.id,
          taskId: t.id,
          authorUserId: user.uid,
          body,
          createdAt: new Date().toISOString(),
        }, { merge: true });
      }
    }
  };
}