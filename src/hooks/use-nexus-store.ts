
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

  // 2. Identify the active workspace
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
    if (!db || !activeWorkspace?.id) return null;
    return query(collection(db, 'workspaces', activeWorkspace.id, 'projects'));
  }, [db, activeWorkspace?.id]);
  
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
    if (!globalTasksData || !activeWorkspace?.id) return [];
    return globalTasksData.filter(t => t.workspaceId === activeWorkspace.id);
  }, [globalTasksData, activeWorkspace?.id]);

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

  // 5. Fetch members for the active workspace
  const membersQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspace?.id) return null;
    return query(collection(db, 'workspaces', activeWorkspace.id, 'members'));
  }, [db, activeWorkspace?.id]);
  
  const { data: membersData } = useCollection<WorkspaceMember>(membersQuery);
  const members = useMemo(() => membersData || [], [membersData]);

  const switchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    setActiveProjectId(null); 
    setGlobalSearchQuery('');
  }, []);

  const selectProject = useCallback((id: string | null) => {
    setActiveProjectId(id);
  }, []);

  // Search users in the global /users collection
  const searchUsersByEmail = async (queryText: string): Promise<User[]> => {
    if (!db || !queryText || queryText.trim().length < 2) return [];
    
    const usersRef = collection(db, 'users');
    const term = queryText.trim().toLowerCase();
    
    try {
      const q = query(
        usersRef, 
        orderBy('email'),
        startAt(term),
        endAt(term + '\uf8ff'),
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
    if (!db || !activeWorkspace || !user) return;
    
    // 1. Update the workspace document with the new role
    const newRoles = { 
      ...(activeWorkspace.memberRoles || {}), 
      [targetUser.id]: role 
    };
    
    const wsRef = doc(db, 'workspaces', activeWorkspace.id);
    updateDocumentNonBlocking(wsRef, { memberRoles: newRoles });

    // 2. Add the member record to the subcollection
    const memberRef = doc(db, 'workspaces', activeWorkspace.id, 'members', targetUser.id);
    setDocumentNonBlocking(memberRef, {
      id: targetUser.id,
      workspaceId: activeWorkspace.id,
      userId: targetUser.id,
      displayName: targetUser.name || 'User',
      email: targetUser.email?.toLowerCase() || '',
      avatarUrl: targetUser.avatarUrl || null,
    }, { merge: true });
  }, [db, activeWorkspace, user]);

  const createInviteLink = useCallback((options: { role: 'member' | 'lead', expiresDays: number | 'never', maxUses: number | 'unlimited' }) => {
    if (!db || !activeWorkspace || !user) return;
    
    const inviteRef = doc(collection(db, 'invitations'));
    const expiresAt = options.expiresDays === 'never' ? null : new Date(Date.now() + options.expiresDays * 24 * 60 * 60 * 1000).toISOString();
    
    const inviteData: Invitation = {
      id: inviteRef.id,
      workspaceId: activeWorkspace.id,
      workspaceName: activeWorkspace.name,
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
  }, [db, activeWorkspace, user]);

  return {
    currentUser: user ? { id: user.uid, name: user.displayName || 'User', email: user.email || '', avatarUrl: user.photoURL || null } : null,
    workspaces,
    activeWorkspace: activeWorkspace || { id: '', name: 'Loading...', color: '#ccc', memberRoles: {}, ownerUserId: '' },
    workspaceProjects: projects,
    activeProject,
    allWorkspaceTasks,
    projectTasks,
    myTasks,
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
      if (!db || !activeWorkspace) return;
      // Remove from subcollection
      const memberRef = doc(db, 'workspaces', activeWorkspace.id, 'members', memberId);
      deleteDocumentNonBlocking(memberRef);

      // Remove from role map
      const newRoles = { ...activeWorkspace.memberRoles };
      delete newRoles[memberId];
      const wsRef = doc(db, 'workspaces', activeWorkspace.id);
      updateDocumentNonBlocking(wsRef, { memberRoles: newRoles });
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
