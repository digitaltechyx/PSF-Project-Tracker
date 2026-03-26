
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
  orderBy,
  startAt,
  endAt
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

  // 2. Identify the active workspace with stability
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

  // 3. Fetch projects for the active workspace
  const projectsQuery = useMemoFirebase(() => {
    const wsId = activeWorkspaceId || activeWorkspace?.id;
    if (!db || !wsId) return null;
    return query(collection(db, 'workspaces', wsId, 'projects'));
  }, [db, activeWorkspaceId, activeWorkspace?.id]);
  
  const { data: projectsData, isLoading: isProjectsLoading } = useCollection<Project>(projectsQuery);
  const projects = useMemo(() => projectsData || [], [projectsData]);

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  // 4. Fetch all tasks via collection group for a global view
  const globalTasksQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return query(collectionGroup(db, 'tasks'));
  }, [db, user?.uid]);
  
  const { data: globalTasksData, isLoading: isTasksLoading } = useCollection<Task>(globalTasksQuery);
  
  const allWorkspaceTasks = useMemo(() => {
    const wsId = activeWorkspaceId || activeWorkspace?.id;
    if (!globalTasksData || !wsId) return [];
    return globalTasksData.filter(t => t.workspaceId === wsId);
  }, [globalTasksData, activeWorkspaceId, activeWorkspace?.id]);

  const myTasks = useMemo(() => {
    if (!user?.uid) return [];
    return allWorkspaceTasks.filter(t => t.assigneeUserId === user.uid);
  }, [allWorkspaceTasks, user?.uid]);

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

  // 5. Fetch member profile documents for details
  const membersQuery = useMemoFirebase(() => {
    const wsId = activeWorkspaceId || activeWorkspace?.id;
    if (!db || !wsId) return null;
    return query(collection(db, 'workspaces', wsId, 'members'));
  }, [db, activeWorkspaceId, activeWorkspace?.id]);
  
  const { data: membersData } = useCollection<WorkspaceMember>(membersQuery);
  const profiles = useMemo(() => membersData || [], [membersData]);

  // 6. DERIVED TEAM LIST: Combine memberRoles (truth) with profiles (details)
  const workspaceMembers = useMemo(() => {
    if (!activeWorkspace) return [];
    const roles = activeWorkspace.memberRoles || {};
    return Object.entries(roles).map(([uid, role]) => {
      const profile = profiles.find(p => p.userId === uid || p.id === uid);
      return {
        id: uid,
        userId: uid,
        role: role as 'owner' | 'lead' | 'member',
        displayName: profile?.displayName || (uid === user?.uid ? user.displayName : 'Pending...'),
        email: profile?.email || '',
        avatarUrl: profile?.avatarUrl || null,
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
    const usersRef = collection(db, 'users');
    const term = queryText.trim().toLowerCase();
    try {
      // Direct exact match first, then fall back to prefix matching
      const q = query(
        usersRef, 
        where('email', '>=', term),
        where('email', '<=', term + '\uf8ff'),
        limit(5)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as User));
    } catch (error) {
      console.error("Search failed:", error);
      return [];
    }
  };

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

    // Add owner as the first member
    const memberRef = doc(db, 'workspaces', wsRef.id, 'members', user.uid);
    setDocumentNonBlocking(memberRef, {
      id: user.uid,
      workspaceId: wsRef.id,
      userId: user.uid,
      displayName: user.displayName || 'Anonymous',
      email: user.email?.toLowerCase() || '',
      avatarUrl: user.photoURL || null,
    }, { merge: true });

    setActiveWorkspaceId(wsRef.id);
  }, [db, user]);

  const directAddMember = useCallback((targetUser: User, role: 'member' | 'lead') => {
    const wsId = activeWorkspaceId || activeWorkspace?.id;
    if (!db || !wsId || !user) return;
    
    const wsRef = doc(db, 'workspaces', wsId);
    const currentRoles = activeWorkspace?.memberRoles || {};
    const newRoles = { 
      ...currentRoles, 
      [targetUser.id]: role 
    };
    
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
  }, [db, activeWorkspace, activeWorkspaceId, user]);

  const createInviteLink = useCallback((options: { role: 'member' | 'lead', expiresDays: number | 'never', maxUses: number | 'unlimited' }) => {
    const wsId = activeWorkspaceId || activeWorkspace?.id;
    if (!db || !wsId || !user) return;
    
    const inviteRef = doc(collection(db, 'invitations'));
    const expiresAt = options.expiresDays === 'never' ? null : new Date(Date.now() + options.expiresDays * 24 * 60 * 60 * 1000).toISOString();
    
    const inviteData: Invitation = {
      id: inviteRef.id,
      workspaceId: wsId,
      workspaceName: activeWorkspace?.name || 'Workspace',
      role: options.role,
      invitedBy: user.uid,
      invitedByName: user.displayName || 'User',
      type: 'link',
      status: 'active',
      usageCount: 0,
      maxUses: options.maxUses,
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    setDocumentNonBlocking(inviteRef, inviteData, { merge: true });
    return inviteRef.id;
  }, [db, activeWorkspace, activeWorkspaceId, user]);

  return {
    currentUser: user ? { id: user.uid, name: user.displayName || 'User', email: user.email || '', avatarUrl: user.photoURL || null } : null,
    workspaces,
    activeWorkspace: activeWorkspace || { id: '', name: 'Loading...', color: '#ccc', memberRoles: {}, ownerUserId: '' },
    workspaceProjects: projects,
    activeProject,
    allWorkspaceTasks,
    projectTasks,
    myTasks,
    workspaceMembers, // Now returns the derived team list
    workspaceNotifications: [],
    globalSearchQuery,
    isTasksLoading,
    isProjectsLoading,
    isWorkspacesLoading,
    setGlobalSearchQuery,
    switchWorkspace,
    selectProject,
    createWorkspace,
    searchUsersByEmail,
    directAddMember,
    createInviteLink,
    updateTask: (taskId: string, data: Partial<Task>) => {
      if (!db) return;
      const t = allWorkspaceTasks.find(x => x.id === taskId);
      if (t) {
        const ref = doc(db, 'workspaces', t.workspaceId, 'projects', t.projectId, 'tasks', t.id);
        updateDocumentNonBlocking(ref, { ...data, updatedAt: new Date().toISOString() });
      }
    },
    deleteTask: (taskId: string) => {
      if (!db) return;
      const t = allWorkspaceTasks.find(x => x.id === taskId);
      if (t) {
        const ref = doc(db, 'workspaces', t.workspaceId, 'projects', t.projectId, 'tasks', t.id);
        deleteDocumentNonBlocking(ref);
      }
    },
    removeMember: (memberId: string) => {
      const wsId = activeWorkspaceId || activeWorkspace?.id;
      if (!db || !wsId) return;
      
      const memberRef = doc(db, 'workspaces', wsId, 'members', memberId);
      deleteDocumentNonBlocking(memberRef);

      const currentRoles = { ...(activeWorkspace?.memberRoles || {}) };
      delete currentRoles[memberId];
      const wsRef = doc(db, 'workspaces', wsId);
      updateDocumentNonBlocking(wsRef, { memberRoles: currentRoles });
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
