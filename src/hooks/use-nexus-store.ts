"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  mockWorkspaces, 
  mockProjects, 
  mockTasks, 
  mockWorkspaceMembers, 
  currentUser 
} from '@/lib/mock-data';
import { Workspace, Project, Task, Status, Priority, WorkspaceMember, User } from '@/lib/types';

export function useNexusStore() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(mockWorkspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(mockWorkspaces[0].id);
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [members, setMembers] = useState<WorkspaceMember[]>(mockWorkspaceMembers);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

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

  const workspaceTasks = useMemo(() => 
    tasks.filter(t => t.workspaceId === activeWorkspaceId),
    [tasks, activeWorkspaceId]
  );

  const projectTasks = useMemo(() => 
    activeProjectId ? tasks.filter(t => t.projectId === activeProjectId) : [],
    [tasks, activeProjectId]
  );

  const workspaceMembers = useMemo(() => 
    members.filter(m => m.workspaceId === activeWorkspaceId),
    [members, activeWorkspaceId]
  );

  // Actions
  const switchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    setActiveProjectId(null); // Reset project view when switching workspaces
  }, []);

  const selectProject = useCallback((id: string | null) => {
    setActiveProjectId(id);
  }, []);

  const createProject = useCallback((name: string, description: string) => {
    const newProject: Project = {
      id: Math.random().toString(36).substr(2, 9),
      workspaceId: activeWorkspaceId,
      name,
      description,
      color: '#452ED2',
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
      id: Math.random().toString(36).substr(2, 9),
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
      id: Math.random().toString(36).substr(2, 9),
      workspaceId: activeWorkspaceId,
      userId: Math.random().toString(36).substr(2, 9),
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
    workspaceTasks,
    projectTasks,
    workspaceMembers,
    switchWorkspace,
    selectProject,
    createProject,
    updateProject,
    deleteProject,
    createTask,
    updateTask,
    deleteTask,
    addMockMember,
  };
}