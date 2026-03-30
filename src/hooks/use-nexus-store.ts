
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
import { Workspace, Project, Task, WorkspaceMember, Invitation } from '@/lib/types';
import { createNotification, notifyTaskAssigned, notifyTaskUpdated } from '@/lib/notifications';
import { sendWorkspaceInviteEmail } from '@/app/actions/send-workspace-invite-email';

export function useNexusStore() {
  const { user, isAuthReady } = useUser();
  const db = useFirestore();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isPrefsLoading, setIsPrefsLoading] = useState(true);

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

  const isOwner = useMemo(() => activeWorkspace?.ownerUserId === user?.uid, [activeWorkspace, user?.uid]);
  const currentRole = useMemo(() => {
    if (isOwner) return 'owner';
    return activeWorkspace?.memberRoles?.[user?.uid || ''] || null;
  }, [activeWorkspace, user?.uid, isOwner]);

  const isAdmin = useMemo(() => isOwner || currentRole === 'lead' || currentRole === 'owner' || currentRole === 'admin', [isOwner, currentRole]);

  const projectsQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId || wsId === '' || !isAuthReady) return null;
    return query(collection(db, 'workspaces', wsId, 'projects'));
  }, [db, user?.uid, activeWorkspace?.id, isAuthReady]);
  
  const { data: projectsData } = useCollection<Project>(projectsQuery);
  
  const projects = useMemo(() => {
    if (!projectsData) return [];
    if (isAdmin) return projectsData;
    return projectsData.filter(p => p.allowedUserIds?.includes(user?.uid || ''));
  }, [projectsData, isAdmin, user?.uid]);

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

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
    return allWorkspaceTasks.filter(t => t.assigneeUserId === user.uid);
  }, [allWorkspaceTasks, user?.uid]);

  const projectTasks = useMemo(() => {
    if (!activeProject) return [];
    return allWorkspaceTasks.filter(t => t.projectId === activeProject.id);
  }, [allWorkspaceTasks, activeProject]);

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
      setActiveWorkspaceId(wsRef.id);
      return wsRef.id;
    } catch (e) {
      console.error("Failed to create workspace:", e);
      return null;
    }
  }, [db, user]);

  const createTask = useCallback(async (wsId: string, projectId: string, data: any) => {
    if (!db || !wsId || !projectId || !user) return null;
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
      
      // Notify assignee if it's not the current user
      if (data.assigneeUserId && data.assigneeUserId !== user.uid) {
        notifyTaskAssigned(db, data.assigneeUserId, { id: user.uid, name: user.displayName || 'User' }, {
          id: taskRef.id,
          title: data.title,
          workspaceId: wsId,
          projectId
        });
      }
      return taskRef.id;
    } catch (e) {
      console.error("Failed to create task:", e);
      return null;
    }
  }, [db, user]);

  const updateTask = useCallback((taskId: string, data: Partial<Task>) => {
    if (!db || !isAdmin || !user) return;
    const t = allWorkspaceTasks.find(x => x.id === taskId);
    if (t) {
      const ref = doc(db, 'workspaces', t.workspaceId, 'projects', t.projectId, 'tasks', t.id);
      updateDocumentNonBlocking(ref, { ...data, updatedAt: new Date().toISOString() });

      // Detect meaningful changes for notification
      const changes: string[] = [];
      if (data.title && data.title !== t.title) changes.push('title');
      if (data.status && data.status !== t.status) changes.push('status');
      if (data.priority && data.priority !== t.priority) changes.push('priority');
      if (data.dueDate !== undefined && data.dueDate !== t.dueDate) changes.push('due date');

      const recipientId = data.assigneeUserId || t.assigneeUserId;
      
      // 1. Notify of new assignment if it changed
      if (data.assigneeUserId && data.assigneeUserId !== t.assigneeUserId) {
        notifyTaskAssigned(db, data.assigneeUserId, { id: user.uid, name: user.displayName || 'User' }, {
          id: t.id,
          title: data.title || t.title,
          workspaceId: t.workspaceId,
          projectId: t.projectId
        });
      } else if (recipientId && recipientId !== user.uid && changes.length > 0) {
        // 2. Notify assignee of edits
        notifyTaskUpdated(db, recipientId, { id: user.uid, name: user.displayName || 'User' }, {
          id: t.id,
          title: t.title,
          workspaceId: t.workspaceId,
          projectId: t.projectId
        }, changes);
      }
    }
  }, [db, allWorkspaceTasks, isAdmin, user]);

  const searchUsersByEmail = useCallback(
    async (searchTerm: string) => {
      if (!db || !searchTerm.trim()) return [];
      const term = searchTerm.trim().toLowerCase();
      if (term.length < 2) return [];
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '>=', term),
        where('email', '<=', term + '\uf8ff'),
        limit(25)
      );
      const snap = await getDocs(usersQuery);
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
        .filter((u) => u.id !== user?.uid) as {
        id: string;
        name?: string;
        email?: string;
        avatarUrl?: string | null;
      }[];
    },
    [db, user?.uid]
  );

  const sendEmailInvite = useCallback(
    async (params: {
      recipientEmail: string;
      role: 'member' | 'lead';
      expiresDays: number | 'never';
      maxUses: number | 'unlimited';
      targetProjectIds: string[];
      joinUrl: string;
    }) => {
      if (!db || !user || !activeWorkspace?.id || activeWorkspace.id === '' || !isAdmin) {
        throw new Error('You do not have permission to send invitations.');
      }
      const ws = activeWorkspace;
      const normalized = params.recipientEmail.trim().toLowerCase();
      if (!normalized) throw new Error('Email is required.');
      if (user.email?.toLowerCase() === normalized) {
        throw new Error('You cannot invite your own email address.');
      }

      const inviteRef = doc(collection(db, 'invitations'));
      const expiresAt =
        params.expiresDays === 'never'
          ? null
          : new Date(Date.now() + params.expiresDays * 86400000).toISOString();

      const inviteData: Invitation = {
        id: inviteRef.id,
        workspaceId: ws.id,
        workspaceName: ws.name,
        role: params.role,
        invitedBy: user.uid,
        invitedByName: user.displayName || 'Someone',
        type: 'email',
        status: 'active',
        usageCount: 0,
        maxUses: params.maxUses === 'unlimited' ? 'unlimited' : params.maxUses,
        targetProjectIds: params.targetProjectIds,
        createdAt: new Date().toISOString(),
        expiresAt,
        invitedEmail: normalized,
      };

      await setDocumentNonBlocking(inviteRef, inviteData, { merge: true });

      await sendWorkspaceInviteEmail({
        to: normalized,
        workspaceName: ws.name,
        inviterName: inviteData.invitedByName,
        joinUrl: `${params.joinUrl.replace(/\/$/, '')}/join/${inviteRef.id}`,
      });

      return inviteRef.id;
    },
    [db, user, activeWorkspace, isAdmin]
  );

  const directAddMember = useCallback(
    async (
      targetUser: {
        id: string;
        name?: string;
        email?: string;
        avatarUrl?: string | null;
      },
      targetRole: 'member' | 'lead',
      projectIds: string[]
    ) => {
      const wsId = activeWorkspace?.id;
      if (!db || !wsId || !user || !isAdmin) {
        throw new Error('You do not have permission to add members.');
      }
      if (targetUser.id === user.uid) throw new Error('You are already in this workspace.');
      if (activeWorkspace?.memberRoles?.[targetUser.id]) {
        throw new Error('This user is already a member.');
      }

      const wsRef = doc(db, 'workspaces', wsId);
      await updateDocumentNonBlocking(wsRef, {
        [`memberRoles.${targetUser.id}`]: targetRole,
        updatedAt: new Date().toISOString(),
      });

      const memberRef = doc(db, 'workspaces', wsId, 'members', targetUser.id);
      await setDocumentNonBlocking(
        memberRef,
        {
          id: targetUser.id,
          workspaceId: wsId,
          userId: targetUser.id,
          displayName: targetUser.name || 'User',
          email: (targetUser.email || '').toLowerCase(),
          avatarUrl: targetUser.avatarUrl ?? null,
        },
        { merge: true }
      );

      for (const projId of projectIds) {
        const projRef = doc(db, 'workspaces', wsId, 'projects', projId);
        const projSnap = await getDoc(projRef);
        if (projSnap.exists()) {
          const projData = projSnap.data() as Project;
          const allowedIds = [...(projData.allowedUserIds || []), targetUser.id];
          await updateDocumentNonBlocking(projRef, {
            allowedUserIds: Array.from(new Set(allowedIds)),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    },
    [db, user, activeWorkspace, isAdmin]
  );

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
    globalSearchQuery,
    isTasksLoading,
    isWorkspacesLoading: isWorkspacesLoading || isPrefsLoading,
    isAdmin,
    isOwner,
    currentRole,
    setGlobalSearchQuery,
    switchWorkspace,
    selectProject,
    createWorkspace,
    createProject: (wsId: string, name: string, description: string) => {
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
      setDocumentNonBlocking(projRef, projData, { merge: true });
      return projRef.id;
    },
    updateProjectMembers: (projectId: string, allowedUserIds: string[]) => {
      const wsId = activeWorkspace?.id;
      if (!db || !wsId || !projectId || !isAdmin) return;
      const ref = doc(db, 'workspaces', wsId, 'projects', projectId);
      updateDocumentNonBlocking(ref, { allowedUserIds, updatedAt: new Date().toISOString() });
    },
    createTask,
    updateTask,
    markNotificationAsRead: async (notifId: string) => {
      if (!db || !user) return;
      const ref = doc(db, 'notifications', notifId);
      updateDocumentNonBlocking(ref, { read: true });
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

      // Notify assignee about the comment if it's not them
      if (task.assigneeUserId && task.assigneeUserId !== user.uid) {
        createNotification(db, {
          userId: task.assigneeUserId,
          actorId: user.uid,
          actorName: user.displayName || 'User',
          type: 'comment_added',
          title: 'New Comment',
          message: `${user.displayName} commented on "${task.title}"`,
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          taskId: task.id
        });
      }
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
    },
    searchUsersByEmail,
    sendEmailInvite,
    directAddMember,
  };
}
