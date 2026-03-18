"use client";

import { useState, useCallback, useMemo } from 'react';
import { 
  mockWorkspaces, 
  mockProjects, 
  mockTasks, 
  mockWorkspaceMembers, 
  currentUser 
} from '@/lib/mock-data';
import { Workspace, Project, Task, WorkspaceMember } from '@/lib/types';

export function useNexusStore() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(mockWorkspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(mockWorkspaces[0].id);
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [members, setMembers] = useState<WorkspaceMember[]>(mockWorkspaceMembers);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const activeWorkspace = useMemo(() => 
    workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0],
    [workspaces, activeWorkspaceId]
  );

  const workspaceProjects = useMemo(() => 
    projects.filter(p => p.workspaceId === activeWorkspaceId),
    [projects, activeWorkspaceId]
  );

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const filterTasks = useCallback((taskList: Task[], query: string) => {
    if (!query) return taskList;
    const lowerQuery = query.toLowerCase();
    return taskList.filter(t => 
      t.title.toLowerCase().includes(lowerQuery) ||
      (t.description && t.description.toLowerCase().includes(lowerQuery)) ||
      (t.tags && t.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
    );
  }, []);

  const workspaceTasks = useMemo(() => {
    const wsTasks = tasks.filter(t => t.workspaceId === activeWorkspaceId);
    return filterTasks(wsTasks, globalSearchQuery);
  }, [tasks, activeWorkspaceId, globalSearchQuery, filterTasks]);

  const projectTasks = useMemo(() => {
    const pTasks = activeProjectId ? tasks.filter(t => t.projectId === activeProjectId) : [];
    return filterTasks(pTasks, globalSearchQuery);
  }, [tasks, activeProjectId, globalSearchQuery, filterTasks]);

  const myTasks = useMemo(() => {
    const mTasks = tasks.filter(t => t.assigneeUserId === currentUser.id);
    return filterTasks(mTasks, globalSearchQuery);
  }, [tasks, globalSearchQuery, filterTasks]);

  const workspaceMembers = useMemo(() => 
    members.filter(m => m.workspaceId === activeWorkspaceId),
    [members, activeWorkspaceId]
  );

  // Actions
  const switchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    setActiveProjectId(null); 
  }, []);

  const selectProject = useCallback((id: string | null) => {
    setActiveProjectId(id);
  }, []);

  const createWorkspace = useCallback((name: string, description: string) => {
    const newWorkspace: Workspace = {
      id: Math.random().toString(36).substring(2, 11),
      name,
      description,
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      ownerUserId: currentUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setWorkspaces(prev => [...prev, newWorkspace]);
    setActiveWorkspaceId(newWorkspace.id);
    setActiveProjectId(null);
    return newWorkspace;
  }, []);

  const createProject = useCallback((name: string, description: string) => {
    const newProject: Project = {
      id: Math.random().toString(36).substring(2, 11),
      workspaceId: activeWorkspaceId,
      name,
      description,
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProjects(prev => [...prev, newProject]);
    return newProject;
  }, [activeWorkspaceId]);

  const updateProject = useCallback((id: string, data: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setTasks(prev => prev.filter(t => t.projectId !== id));
    if (activeProjectId === id) setActiveProjectId(null);
  }, [activeProjectId]);

  const createTask = useCallback((projectId: string, title: string, description: string) => {
    const newTask: Task = {
      id: Math.random().toString(36).substring(2, 11),
      workspaceId: activeWorkspaceId,
      projectId,
      title,
      description,
      status: 'todo',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, [activeWorkspaceId]);

  const updateTask = useCallback((id: string, data: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const addMockMember = useCallback((name: string, email: string) => {
    const newMember: WorkspaceMember = {
      id: Math.random().toString(36).substring(2, 11),
      workspaceId: activeWorkspaceId,
      userId: Math.random().toString(36).substring(2, 11),
      displayName: name,
      email,
      avatarUrl: `https://picsum.photos/seed/${name}/100/100`,
    };
    setMembers(prev => [...prev, newMember]);
  }, [activeWorkspaceId]);

  return {
    currentUser,
    workspaces,
    activeWorkspace,
    workspaceProjects,
    activeProject,
    tasks,
    workspaceTasks,
    projectTasks,
    myTasks,
    workspaceMembers,
    globalSearchQuery,
    setGlobalSearchQuery,
    switchWorkspace,
    selectProject,
    createWorkspace,
    createProject,
    updateProject,
    deleteProject,
    createTask,
    updateTask,
    deleteTask,
    addMockMember,
  };
}
