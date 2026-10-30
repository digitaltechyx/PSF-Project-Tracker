
"use client";

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Search, 
  Plus, 
  ChevronDown,
  Box,
  ListTodo,
  Bell,
  LogOut,
  Settings,
  Trash2,
  Clock,
  Menu,
  Target,
  MessageSquare,
  FileText,
  StickyNote,
  Layers,
  ChevronRight,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNexusStore } from '@/hooks/use-nexus-store';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DashboardView } from './views/DashboardView';
import { ProjectView } from './views/ProjectView';
import { MembersView } from './views/MembersView';
import { MyTasksView } from './views/MyTasksView';
import { NotificationsView } from './views/NotificationsView';
import { AttendanceLogView } from './views/AttendanceLogView';
import { TargetsView } from './views/TargetsView';
import { ChatView } from './views/ChatView';
import { DocsView } from './views/DocsView';
import { NotesView } from './views/NotesView';
import { ProgramDashboardView } from './views/ProgramDashboardView';
import { InviteMembersModal } from './invitations/InviteMembersModal';
import { NotificationBell } from './notifications/NotificationBell';
import { EditWorkspaceModal } from './workspaces/EditWorkspaceModal';
import { DeleteWorkspaceButton } from './workspaces/DeleteWorkspaceButton';
import { Sheet, SheetContent } from '@/components/ui/sheet';

type ViewType = 'dashboard' | 'program' | 'project' | 'members' | 'my-tasks' | 'notifications' | 'attendance' | 'targets' | 'chat' | 'docs' | 'notes';

export function NexusShell() {
  const store = useNexusStore();
  const auth = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  // Dialog States
  const [isWsDialogOpen, setIsWsDialogOpen] = useState(false);
  const [isWsEditDialogOpen, setIsWsEditDialogOpen] = useState(false);
  const [isProgDialogOpen, setIsProgDialogOpen] = useState(false);
  const [isProjDialogOpen, setIsProjDialogOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [newProgName, setNewProgName] = useState('');
  const [newProgDesc, setNewProgDesc] = useState('');
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjProgramId, setNewProjProgramId] = useState('');
  const [expandedProgramIds, setExpandedProgramIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (currentView === 'targets' && !store.canAccessTargets) {
      setCurrentView('dashboard');
    }
  }, [currentView, store.canAccessTargets]);

  const handleNavClick = (view: ViewType) => {
    if (view !== 'project' && view !== 'program') store.selectProject(null);
    setCurrentView(view);
    setMobileNavOpen(false);
  };

  const handleProgramClick = (id: string) => {
    store.selectProgram(id);
    setExpandedProgramIds((prev) => ({ ...prev, [id]: true }));
    setCurrentView('program');
    setMobileNavOpen(false);
  };

  const handleProjectClick = (id: string) => {
    store.selectProject(id);
    setCurrentView('project');
    setMobileNavOpen(false);
  };

  const handleNavigateToTask = (wsId: string, projId: string, taskId: string) => {
    if (store.activeWorkspace?.id !== wsId) {
      store.switchWorkspace(wsId);
    }
    store.selectProject(projId);
    setCurrentView('project');
    store.openTask?.(taskId);
  };

  const handleCreateWorkspace = () => {
    if (newWsName) {
      store.createWorkspace(newWsName, newWsDesc);
      setNewWsName('');
      setNewWsDesc('');
      setIsWsDialogOpen(false);
    }
  };

  const handleCreateProgram = async () => {
    if (!newProgName.trim()) return;
    try {
      await store.createProgram({ name: newProgName, description: newProgDesc });
      setNewProgName('');
      setNewProgDesc('');
      setIsProgDialogOpen(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Could not create program');
    }
  };

  const openCreateProject = (programId?: string) => {
    setNewProjProgramId(programId || store.activeProgramId || store.workspacePrograms?.[0]?.id || '');
    setIsProjDialogOpen(true);
  };

  const handleCreateProject = async () => {
    if (!newProjName.trim() || !store.activeWorkspace?.id) return;
    if (!newProjProgramId) {
      alert('Select a program first.');
      return;
    }
    try {
      const id = await store.createProject(
        store.activeWorkspace.id,
        newProjName,
        newProjDesc,
        newProjProgramId
      );
      setNewProjName('');
      setNewProjDesc('');
      setIsProjDialogOpen(false);
      if (id) handleProjectClick(id);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Could not create project');
    }
  };

  const toggleProgramExpanded = (programId: string) => {
    setExpandedProgramIds((prev) => ({
      ...prev,
      [programId]: !(prev[programId] ?? true),
    }));
  };

  const isProgramExpanded = (programId: string) =>
    expandedProgramIds[programId] ?? true;

  const projectsForProgram = (programId: string) =>
    (store.workspaceProjects || []).filter((p: any) => p.programId === programId);

  const handleLogout = () => {
    auth.signOut();
  };

  if (!mounted || !store.currentUser) return <div className="h-screen w-full bg-background" />;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="app-sidebar hidden md:flex w-[272px] flex-col shrink-0">
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex-1 justify-between hover:bg-white/10 text-white font-semibold px-2 overflow-hidden">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div 
                    className="w-7 h-7 rounded-lg flex-shrink-0 ring-1 ring-white/20 shadow-sm" 
                    style={{ backgroundColor: store.activeWorkspace?.color || '#ccc' }}
                  />
                  <div className="text-left min-w-0">
                    <span className="block truncate text-sm">{store.activeWorkspace?.name || 'Loading...'}</span>
                    <span className="block text-[9px] font-medium uppercase tracking-widest text-white/35">Workspace</span>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                My Workspaces
              </div>
              {store.workspaces?.map(w => (
                <DropdownMenuItem key={w.id} onClick={() => store.switchWorkspace(w.id)}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded" 
                      style={{ backgroundColor: w.color }}
                    />
                    <span>{w.name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-white/55 hover:text-white hover:bg-white/10 flex-shrink-0"
            onClick={() => setIsWsDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          {store.isOwner && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-white/55 hover:text-white hover:bg-white/10 flex-shrink-0"
                onClick={() => setIsWsEditDialogOpen(true)}
                title="Edit workspace"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <DeleteWorkspaceButton store={store} variant="ghost" size="icon" className="h-8 w-8 text-white/55 hover:text-red-300 hover:bg-white/10 flex-shrink-0" />
            </>
          )}
        </div>

        <ScrollArea className="flex-1 px-3 py-5">
          <div className="space-y-1 mb-6">
            <Button 
              variant="ghost"
              data-active={currentView === 'dashboard'}
              className="sidebar-nav-btn"
              onClick={() => handleNavClick('dashboard')}
            >
              <LayoutDashboard className="h-4 w-4" />
              Home
            </Button>
            <Button 
              variant="ghost"
              data-active={currentView === 'my-tasks'}
              className="sidebar-nav-btn"
              onClick={() => handleNavClick('my-tasks')}
            >
              <ListTodo className="h-4 w-4" />
              My Tasks
            </Button>
            <Button 
              variant="ghost"
              data-active={currentView === 'notifications'}
              className="sidebar-nav-btn"
              onClick={() => handleNavClick('notifications')}
            >
              <Bell className="h-4 w-4" />
              Inbox
            </Button>
            <Button 
              variant="ghost"
              data-active={currentView === 'attendance'}
              className="sidebar-nav-btn"
              onClick={() => handleNavClick('attendance')}
            >
              <Clock className="h-4 w-4" />
              {store.isAdmin ? 'Team time' : 'My time'}
            </Button>
            {store.canAccessTargets && (
              <Button 
                variant="ghost"
                data-active={currentView === 'targets'}
                className="sidebar-nav-btn"
                onClick={() => handleNavClick('targets')}
              >
                <Target className="h-4 w-4" />
                Targets
              </Button>
            )}
            <Button 
              variant="ghost"
              data-active={currentView === 'chat'}
              className="sidebar-nav-btn"
              onClick={() => handleNavClick('chat')}
            >
              <MessageSquare className="h-4 w-4" />
              Chat
            </Button>
              <Button
                variant="ghost"
                data-active={currentView === 'docs'}
                className="sidebar-nav-btn"
                onClick={() => handleNavClick('docs')}
              >
                <FileText className="h-4 w-4" />
                Docs
              </Button>
              <Button
                variant="ghost"
                data-active={currentView === 'notes'}
                className="sidebar-nav-btn"
                onClick={() => handleNavClick('notes')}
              >
                <StickyNote className="h-4 w-4" />
                Notes
              </Button>
              <Button
                variant="ghost"
                data-active={currentView === 'members'}
                className="sidebar-nav-btn"
                onClick={() => handleNavClick('members')}
              >
              <Users className="h-4 w-4" />
              People
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-2 text-[10px] font-semibold text-white/50 uppercase tracking-wider">
              Programs
              {store.isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-white/50 hover:bg-white/10 hover:text-white"
                  title="New program"
                  onClick={() => setIsProgDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {(store.workspacePrograms || []).length === 0 && (
                <p className="px-2 text-[11px] text-white/40">
                  {store.isAdmin ? 'Create a program to add projects.' : 'No programs yet.'}
                </p>
              )}
              {(store.workspacePrograms || []).map((prog: any) => {
                const open = isProgramExpanded(prog.id);
                const childProjects = projectsForProgram(prog.id);
                return (
                  <div key={prog.id} className="space-y-0.5">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
                        onClick={() => toggleProgramExpanded(prog.id)}
                        title={open ? 'Collapse' : 'Expand'}
                      >
                        {open ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <Button
                        variant="ghost"
                        data-active={store.activeProgramId === prog.id && currentView === 'program'}
                        className="sidebar-nav-btn font-medium flex-1 min-w-0"
                        onClick={() => handleProgramClick(prog.id)}
                      >
                        <Layers className="h-4 w-4 shrink-0" style={{ color: prog.color }} />
                        <span className="truncate">{prog.name}</span>
                      </Button>
                      {store.isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-white/40 hover:bg-white/10 hover:text-white"
                          title={`Add project to ${prog.name}`}
                          onClick={() => openCreateProject(prog.id)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {open && (
                      <div className="ml-4 space-y-0.5 border-l border-white/10 pl-2">
                        {childProjects.length === 0 ? (
                          <p className="px-2 py-1 text-[10px] text-white/35">No projects</p>
                        ) : (
                          childProjects.map((p: any) => (
                            <Button
                              key={p.id}
                              variant="ghost"
                              data-active={store.activeProject?.id === p.id && currentView === 'project'}
                              className="sidebar-nav-btn font-normal"
                              onClick={() => {
                                store.selectProgram(prog.id);
                                handleProjectClick(p.id);
                              }}
                            >
                              <Box className="h-4 w-4" style={{ color: p.color }} />
                              <span className="truncate">{p.name}</span>
                            </Button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-white/10 mt-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="h-8 w-8 ring-2 ring-white/20">
                <AvatarImage src={store.currentUser.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-white/10 text-white">{store.currentUser.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold truncate text-white">{store.currentUser.name}</span>
                <span className="text-[10px] text-white/50 truncate uppercase">{store.currentRole}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        <header className="h-16 border-b border-border/60 flex items-center justify-between px-4 md:px-6 bg-card/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 shrink-0"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="hidden md:block text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {store.activeWorkspace?.name}
              </p>
              <h1 className="text-base md:text-lg font-semibold font-headline truncate">
              {currentView === 'dashboard' ? 'Overview' : 
               currentView === 'members' ? 'People' : 
               currentView === 'my-tasks' ? 'My Tasks' :
               currentView === 'notifications' ? 'Inbox' :
               currentView === 'attendance' ? (store.isAdmin ? 'Team time' : 'My time') :
               currentView === 'targets' ? 'Targets' :
               currentView === 'chat' ? 'Chat' :
               currentView === 'docs' ? 'Docs' :
               currentView === 'notes' ? 'Notes' :
               currentView === 'program' ? (store.activeProgram?.name || 'Program') :
               store.activeProject?.name || 'Project'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {currentView !== 'dashboard' && currentView !== 'program' && currentView !== 'notifications' && currentView !== 'members' && currentView !== 'attendance' && currentView !== 'targets' && currentView !== 'chat' && currentView !== 'docs' && currentView !== 'notes' && (
              <div className="relative w-40 sm:w-64 animate-in fade-in duration-300">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search..." 
                  className="pl-9 h-9 bg-muted/50 border-none" 
                  value={store.globalSearchQuery}
                  onChange={(e) => store.setGlobalSearchQuery(e.target.value)}
                />
              </div>
            )}
            <NotificationBell 
              onNavigateToTask={handleNavigateToTask}
              onViewAll={() => handleNavClick('notifications')}
              markAsRead={store.markNotificationAsRead} 
            />
          </div>
        </header>

        <main className="flex-1 overflow-auto app-main-surface p-4 md:p-6 lg:p-8">
          {currentView === 'dashboard' && (
            <DashboardView
              store={store}
              onNavigateToProject={handleProjectClick}
              onNavigateToProgram={handleProgramClick}
              onNavigateToTask={handleNavigateToTask}
              onNavigateToTargets={() => handleNavClick('targets')}
            />
          )}
          {currentView === 'program' && (
            <ProgramDashboardView
              store={store}
              onNavigateToProject={handleProjectClick}
              onCreateProject={(programId) => openCreateProject(programId)}
            />
          )}
          {currentView === 'project' && <ProjectView store={store} />}
          {currentView === 'members' && (
            <MembersView 
              store={store} 
              onInviteClick={() => setIsInviteOpen(true)} 
              isAdmin={store.isAdmin}
            />
          )}
          {currentView === 'my-tasks' && <MyTasksView store={store} />}
          {currentView === 'notifications' && (
            <NotificationsView store={store} onNavigateToTask={handleNavigateToTask} />
          )}
          {currentView === 'attendance' && <AttendanceLogView store={store} />}
          {currentView === 'targets' && store.canAccessTargets && <TargetsView store={store} />}
          {currentView === 'chat' && <ChatView store={store} />}
          {currentView === 'docs' && <DocsView store={store} />}
          {currentView === 'notes' && <NotesView store={store} />}
        </main>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-72 border-none app-sidebar">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/10">
              <p className="text-sm font-semibold truncate text-white">{store.activeWorkspace?.name}</p>
              <p className="text-xs text-white/50">Menu</p>
            </div>
            <ScrollArea className="flex-1 px-3 py-4">
              <div className="space-y-1 mb-6">
                <Button variant="ghost" data-active={currentView === 'dashboard'} className="sidebar-nav-btn" onClick={() => handleNavClick('dashboard')}>
                  <LayoutDashboard className="h-4 w-4" /> Home
                </Button>
                <Button variant="ghost" data-active={currentView === 'my-tasks'} className="sidebar-nav-btn" onClick={() => handleNavClick('my-tasks')}>
                  <ListTodo className="h-4 w-4" /> My Tasks
                </Button>
                <Button variant="ghost" data-active={currentView === 'notifications'} className="sidebar-nav-btn" onClick={() => handleNavClick('notifications')}>
                  <Bell className="h-4 w-4" /> Inbox
                </Button>
                <Button variant="ghost" data-active={currentView === 'attendance'} className="sidebar-nav-btn" onClick={() => handleNavClick('attendance')}>
                  <Clock className="h-4 w-4" /> {store.isAdmin ? 'Team time' : 'My time'}
                </Button>
                {store.canAccessTargets && (
                  <Button variant="ghost" data-active={currentView === 'targets'} className="sidebar-nav-btn" onClick={() => handleNavClick('targets')}>
                    <Target className="h-4 w-4" /> Targets
                  </Button>
                )}
                <Button variant="ghost" data-active={currentView === 'chat'} className="sidebar-nav-btn" onClick={() => handleNavClick('chat')}>
                  <MessageSquare className="h-4 w-4" /> Chat
                </Button>
                <Button variant="ghost" data-active={currentView === 'docs'} className="sidebar-nav-btn" onClick={() => handleNavClick('docs')}>
                  <FileText className="h-4 w-4" /> Docs
                </Button>
                <Button variant="ghost" data-active={currentView === 'notes'} className="sidebar-nav-btn" onClick={() => handleNavClick('notes')}>
                  <StickyNote className="h-4 w-4" /> Notes
                </Button>
                <Button variant="ghost" data-active={currentView === 'members'} className="sidebar-nav-btn" onClick={() => handleNavClick('members')}>
                  <Users className="h-4 w-4" /> People
                </Button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 mb-1">
                  <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Programs</p>
                  {store.isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-white/50 hover:bg-white/10 hover:text-white"
                      onClick={() => setIsProgDialogOpen(true)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {(store.workspacePrograms || []).map((prog: any) => {
                  const open = isProgramExpanded(prog.id);
                  const childProjects = projectsForProgram(prog.id);
                  return (
                    <div key={prog.id} className="space-y-0.5">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          className="grid h-7 w-7 place-items-center rounded-md text-white/50 hover:bg-white/10"
                          onClick={() => toggleProgramExpanded(prog.id)}
                        >
                          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                        <Button
                          variant="ghost"
                          data-active={store.activeProgramId === prog.id && currentView === 'program'}
                          className="sidebar-nav-btn font-medium flex-1 min-w-0"
                          onClick={() => handleProgramClick(prog.id)}
                        >
                          <Layers className="h-4 w-4" style={{ color: prog.color }} />
                          <span className="truncate">{prog.name}</span>
                        </Button>
                        {store.isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-white/40 hover:bg-white/10 hover:text-white"
                            onClick={() => openCreateProject(prog.id)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {open && (
                        <div className="ml-4 space-y-0.5 border-l border-white/10 pl-2">
                          {childProjects.map((p: any) => (
                            <Button
                              key={p.id}
                              variant="ghost"
                              data-active={store.activeProject?.id === p.id && currentView === 'project'}
                              className="sidebar-nav-btn font-normal"
                              onClick={() => {
                                store.selectProgram(prog.id);
                                handleProjectClick(p.id);
                              }}
                            >
                              <Box className="h-4 w-4" style={{ color: p.color }} />
                              <span className="truncate">{p.name}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Global Dialogs */}
      <Dialog open={isWsDialogOpen} onOpenChange={setIsWsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>Start a new collaborative workspace for your team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input id="ws-name" placeholder="e.g. Operations" value={newWsName} onChange={(e) => setNewWsName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-desc">Description</Label>
              <Textarea id="ws-desc" placeholder="Optional" value={newWsDesc} onChange={(e) => setNewWsDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateWorkspace}>Create workspace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProgDialogOpen} onOpenChange={setIsProgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create program</DialogTitle>
            <DialogDescription>
              Programs group related projects. Hierarchy: Program → Project → Task → Subtask.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="prog-name">Program name</Label>
              <Input
                id="prog-name"
                placeholder="e.g. Product launch"
                value={newProgName}
                onChange={(e) => setNewProgName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prog-desc">Description</Label>
              <Textarea
                id="prog-desc"
                placeholder="Optional"
                value={newProgDesc}
                onChange={(e) => setNewProgDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProgDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreateProgram()} disabled={!newProgName.trim()}>
              Create program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProjDialogOpen} onOpenChange={setIsProjDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>Add a project inside a program.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select value={newProjProgramId} onValueChange={setNewProjProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {(store.workspacePrograms || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-name">Project name</Label>
              <Input id="proj-name" placeholder="e.g. Website redesign" value={newProjName} onChange={(e) => setNewProjName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea id="proj-desc" placeholder="Optional" value={newProjDesc} onChange={(e) => setNewProjDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProjDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => void handleCreateProject()}
              disabled={!newProjName.trim() || !newProjProgramId}
            >
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InviteMembersModal 
        isOpen={isInviteOpen} 
        onOpenChange={setIsInviteOpen} 
        store={store} 
      />

      <EditWorkspaceModal
        isOpen={isWsEditDialogOpen}
        onOpenChange={setIsWsEditDialogOpen}
        store={store}
      />
    </div>
  );
}
