
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
  Menu
} from 'lucide-react';
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
import { InviteMembersModal } from './invitations/InviteMembersModal';
import { NotificationBell } from './notifications/NotificationBell';
import { EditWorkspaceModal } from './workspaces/EditWorkspaceModal';
import { DeleteWorkspaceButton } from './workspaces/DeleteWorkspaceButton';
import { Sheet, SheetContent } from '@/components/ui/sheet';

type ViewType = 'dashboard' | 'project' | 'members' | 'my-tasks' | 'notifications' | 'attendance';

export function NexusShell() {
  const store = useNexusStore();
  const auth = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  // Dialog States
  const [isWsDialogOpen, setIsWsDialogOpen] = useState(false);
  const [isWsEditDialogOpen, setIsWsEditDialogOpen] = useState(false);
  const [isProjDialogOpen, setIsProjDialogOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNavClick = (view: ViewType) => {
    if (view !== 'project') store.selectProject(null);
    setCurrentView(view);
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

  const handleCreateProject = () => {
    if (newProjName && store.activeWorkspace?.id) {
      store.createProject(store.activeWorkspace.id, newProjName, newProjDesc);
      setNewProjName('');
      setNewProjDesc('');
      setIsProjDialogOpen(false);
    }
  };

  const handleLogout = () => {
    auth.signOut();
  };

  if (!mounted || !store.currentUser) return <div className="h-screen w-full bg-background" />;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="app-sidebar hidden md:flex w-[260px] flex-col shrink-0">
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex-1 justify-between hover:bg-white/10 text-white font-semibold px-2 overflow-hidden">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div 
                    className="w-5 h-5 rounded flex-shrink-0" 
                    style={{ backgroundColor: store.activeWorkspace?.color || '#ccc' }}
                  />
                  <span className="truncate">{store.activeWorkspace?.name || 'Loading...'}</span>
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
            className="h-8 w-8 text-muted-foreground hover:text-primary flex-shrink-0"
            onClick={() => setIsWsDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          {store.isOwner && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-primary flex-shrink-0"
                onClick={() => setIsWsEditDialogOpen(true)}
                title="Edit workspace"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <DeleteWorkspaceButton store={store} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0" />
            </>
          )}
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
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

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 text-[10px] font-semibold text-white/50 uppercase tracking-wider">
              Projects
              {store.isAdmin && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5 hover:bg-muted" 
                  onClick={() => setIsProjDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="space-y-1">
              {store.workspaceProjects?.map(p => (
                <Button 
                  key={p.id} 
                  variant="ghost"
                  data-active={store.activeProject?.id === p.id && currentView === 'project'}
                  className="sidebar-nav-btn font-normal"
                  onClick={() => handleProjectClick(p.id)}
                >
                  <Box className="h-4 w-4" style={{ color: p.color }} />
                  <span className="truncate">{p.name}</span>
                </Button>
              ))}
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
        <header className="h-14 border-b flex items-center justify-between px-4 md:px-6 bg-card/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 shrink-0"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg md:text-xl font-bold font-headline truncate">
              {currentView === 'dashboard' ? '' : 
               currentView === 'members' ? 'People' : 
               currentView === 'my-tasks' ? 'My Tasks' :
               currentView === 'notifications' ? 'Inbox' :
               currentView === 'attendance' ? (store.isAdmin ? 'Team time' : 'My time') :
               store.activeProject?.name || 'Project'}
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {currentView !== 'dashboard' && currentView !== 'notifications' && currentView !== 'members' && currentView !== 'attendance' && (
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

        <main className="flex-1 overflow-auto app-main-surface p-4 md:p-6">
          {currentView === 'dashboard' && (
            <DashboardView
              store={store}
              onNavigateToProject={handleProjectClick}
              onNavigateToTask={handleNavigateToTask}
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
                <Button variant="ghost" data-active={currentView === 'members'} className="sidebar-nav-btn" onClick={() => handleNavClick('members')}>
                  <Users className="h-4 w-4" /> People
                </Button>
              </div>
              <div className="space-y-1">
                <p className="px-2 text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Projects</p>
                {store.workspaceProjects?.map((p: any) => (
                  <Button
                    key={p.id}
                    variant="ghost"
                    data-active={store.activeProject?.id === p.id && currentView === 'project'}
                    className="sidebar-nav-btn font-normal"
                    onClick={() => handleProjectClick(p.id)}
                  >
                    <Box className="h-4 w-4" style={{ color: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Global Dialogs */}
      <Dialog open={isWsDialogOpen} onOpenChange={setIsWsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>Start a new collaborative workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Workspace Name</Label>
              <Input id="ws-name" value={newWsName} onChange={(e) => setNewWsName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-desc">Description</Label>
              <Textarea id="ws-desc" value={newWsDesc} onChange={(e) => setNewWsDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateWorkspace}>Create Workspace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProjDialogOpen} onOpenChange={setIsProjDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>Add a project to this workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="proj-name">Project Name</Label>
              <Input id="proj-name" value={newProjName} onChange={(e) => setNewProjName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea id="proj-desc" value={newProjDesc} onChange={(e) => setNewProjDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProjDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProject}>Create Project</Button>
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
