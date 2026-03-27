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
  getDoc,
  limit,
  serverTimestamp,
  orderBy,
  addDoc
} from 'firebase/firestore';
import { Workspace, Project, Task, WorkspaceMember, User, Invitation } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function useNexusStore() {
  const { user, isAuthReady } = useUser();
  const db = useFirestore();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isPrefsLoading, setIsPrefsLoading] = useState(true);

  // Load active workspace ID from user document on mount
  useEffect(() => {
    if (isAuthReady && user?.uid && db) {
      const loadUserPrefs = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.lastActiveWorkspaceId) {
              setActiveWorkspaceId(data.lastActiveWorkspaceId);
            }
          }
        } catch (err) {
          console.error("Store: Error loading user prefs:", err);
        } finally {
          setIsPrefsLoading(false);
        }
      };
      loadUserPrefs();
    } else if (isAuthReady && !user) {
      setIsPrefsLoading(false);
    }
  }, [isAuthReady, user?.uid, db]);

  // 1. Fetch all workspaces the user has access to
  const workspacesQuery = useMemoFirebase(() => {
    if (!db || !user?.uid || !isAuthReady) return null;
    return query(
      collection(db, 'workspaces'),
      where(`memberRoles.${user.uid}`, '!=', null)
    );
  }, [db, user?.uid, isAuthReady]);
  
  const { data: workspacesData, isLoading: isWorkspacesLoading } = useCollection<Workspace>(workspacesQuery);
  
  const workspaces = useMemo(() => workspacesData || [], [workspacesData]);

  const activeWorkspace = useMemo(() => {
    if (workspaces.length === 0) return null;
    
    if (activeWorkspaceId) {
      const found = workspaces.find(w => w.id === activeWorkspaceId);
      if (found) return found;
    }
    
    return workspaces[0];
  }, [workspaces, activeWorkspaceId]);

  // Sync state if it falls back
  useEffect(() => {
    if (activeWorkspace && activeWorkspace.id && activeWorkspace.id !== activeWorkspaceId) {
      setActiveWorkspaceId(activeWorkspace.id);
    }
  }, [activeWorkspace, activeWorkspaceId]);

  const isOwner = useMemo(() => activeWorkspace?.ownerUserId === user?.uid, [activeWorkspace, user?.uid]);
  const currentRole = useMemo(() => {
    if (isOwner) return 'owner';
    return activeWorkspace?.memberRoles?.[user?.uid || ''] || null;
  }, [activeWorkspace, user?.uid, isOwner]);

  const isAdmin = useMemo(() => isOwner || currentRole === 'lead' || currentRole === 'owner' || currentRole === 'admin', [isOwner, currentRole]);

  // 2. Fetch projects for the active workspace
  const projectsQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    // Don't fire if no workspace, or if it's the placeholder "Loading..."
    if (!db || !user?.uid || !wsId || wsId === '' || !isAuthReady) return null;
    return query(collection(db, 'workspaces', wsId, 'projects'));
  }, [db, user?.uid, activeWorkspace?.id, isAuthReady]);
  
  const { data: projectsData, isLoading: isProjectsLoading } = useCollection<Project>(projectsQuery);
  
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
    if (!db || !user?.uid || !isAuthReady) return null;
    return query(collectionGroup(db, 'tasks'));
  }, [db, user?.uid, isAuthReady]);
  
  const { data: globalTasksData, isLoading: isTasksLoading } = useCollection<Task>(globalTasksQuery);
  
  const allWorkspaceTasks = useMemo(() => {
    const wsId = activeWorkspace?.id;
    if (!globalTasksData || !wsId) return [];
    
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
    if (!db || !user?.uid || !wsId || wsId === '' || !isAuthReady) return null;
    return query(collection(db, 'workspaces', wsId, 'members'));
  }, [db, user?.uid, activeWorkspace?.id, isAuthReady]);
  
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
    
    // Persist to user doc
    if (user?.uid && db) {
      const userRef = doc(db, 'users', user.uid);
      updateDocumentNonBlocking(userRef, { lastActiveWorkspaceId: id });
    }
  }, [user?.uid, db]);

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
    
    try {
      // Use await to ensure the workspace and member profile exist before finishing.
      // This helps satisfy security rules for subsequent creation calls (like project/task).
      await setDocumentNonBlocking(wsRef, wsData, { merge: true });
      
      const memberRef = doc(db, 'workspaces', wsRef.id, 'members', user.uid);
      await setDocumentNonBlocking(memberRef, {
        id: user.uid,
        workspaceId: wsRef.id,
        userId: user.uid,
        displayName: user.displayName || 'User',
        email: user.email?.toLowerCase() || '',
        avatarUrl: user.photoURL || null,
      }, { merge: true });
      
      // Auto-select newly created workspace and persist
      setActiveWorkspaceId(wsRef.id);
      const userRef = doc(db, 'users', user.uid);
      await updateDocumentNonBlocking(userRef, { lastActiveWorkspaceId: wsRef.id });
      
      return wsRef.id;
    } catch (e) {
      console.error("Failed to create workspace:", e);
      return null;
    }
  }, [db, user]);

  const createInviteLink = useCallback(async (options: { role: 'member' | 'lead', expiresDays: number | 'never', maxUses: number | 'unlimited', targetProjectIds?: string[] }) => {
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
    await setDocumentNonBlocking(inviteRef, inviteData, { merge: true });
    return inviteRef.id;
  }, [db, activeWorkspace, isOwner, user]);

  const searchUsersByEmail = useCallback(async (emailQuery: string) => {
    if (!db || !emailQuery || emailQuery.length < 2) return [];
    try {
      const lowerQuery = emailQuery.toLowerCase();
      const q = query(
        collection(db, 'users'),
        where('email', '>=', lowerQuery),
        where('email', '<=', lowerQuery + '\uf8ff'),
        limit(5)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("User search failed:", error);
      return [];
    }
  }, [db]);

  const directAddMember = useCallback(async (targetUser: any, role: 'member' | 'lead') => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !isAdmin || !targetUser) return;
    
    const wsRef = doc(db, 'workspaces', wsId);
    await updateDocumentNonBlocking(wsRef, {
      [`memberRoles.${targetUser.id}`]: role,
      updatedAt: new Date().toISOString()
    });

    const memberRef = doc(db, 'workspaces', wsId, 'members', targetUser.id);
    await setDocumentNonBlocking(memberRef, {
      id: targetUser.id,
      workspaceId: wsId,
      userId: targetUser.id,
      displayName: targetUser.name || 'User',
      email: targetUser.email?.toLowerCase() || '',
      avatarUrl: targetUser.avatarUrl || null,
    }, { merge: true });
  }, [db, activeWorkspace, isAdmin]);

  const createProject = useCallback(async (wsId: string, name: string, description: string) => {
    if (!db || !wsId) return null;
    const projRef = doc(collection(db, 'workspaces', wsId, 'projects'));
    const projData: Project = {
      id: projRef.id,
      workspaceId: wsId,
      name,
      description: description || '',
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      allowedUserIds: [user?.uid || ''],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDocumentNonBlocking(projRef, projData, { merge: true });
      return projRef.id;
    } catch (e) {
      console.error("Failed to create project:", e);
      return null;
    }
  }, [db, user?.uid]);

  const updateProjectMembers = useCallback(async (projectId: string, allowedUserIds: string[]) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !projectId || !isAdmin) return;
    const ref = doc(db, 'workspaces', wsId, 'projects', projectId);
    await updateDocumentNonBlocking(ref, { allowedUserIds, updatedAt: new Date().toISOString() });
  }, [db, activeWorkspace?.id, isAdmin]);

  const createTask = useCallback(async (wsId: string, projectId: string, data: any) => {
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
    try {
      await setDocumentNonBlocking(taskRef, taskData, { merge: true });
      return taskRef.id;
    } catch (e) {
      console.error("Failed to create task:", e);
      return null;
    }
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
    isWorkspacesLoading: isWorkspacesLoading || isPrefsLoading,
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
    searchUsersByEmail,
    directAddMember,
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
    addComment: async (taskId: string, body: string) => {
      if (!db || !user || !taskId) return;
      const task = allWorkspaceTasks.find(t => t.id === taskId);
      if (!task) return;
      
      const commentRef = doc(collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'comments'));
      const commentData = {
        id: commentRef.id,
        taskId: task.id,
        authorUserId: user.uid,
        body,
        createdAt: new Date().toISOString()
      };
      
      await setDocumentNonBlocking(commentRef, commentData, { merge: true });
    },
    removeMember: async (userId: string) => {
      const wsId = activeWorkspace?.id;
      if (!db || !wsId || !isAdmin || userId === user?.uid) return;
      
      const wsRef = doc(db, 'workspaces', wsId);
      const roles = { ...activeWorkspace!.memberRoles };
      delete roles[userId];
      
      await updateDocumentNonBlocking(wsRef, {
        memberRoles: roles,
        updatedAt: new Date().toISOString()
      });

      const memberRef = doc(db, 'workspaces', wsId, 'members', userId);
      await deleteDocumentNonBlocking(memberRef);
    }
  };
}