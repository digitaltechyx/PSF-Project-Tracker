"use client";

import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  Search, 
  Settings, 
  Plus, 
  ChevronDown,
  ChevronRight,
  Hash,
  Box
} from 'lucide-react';
import { useNexusStore } from '@/hooks/use-nexus-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { DashboardView } from './views/DashboardView';
import { ProjectView } from './views/ProjectView';
import { MembersView } from './views/MembersView';

export function NexusShell() {
  const store = useNexusStore();
  const [currentView, setCurrentView] = useState<'dashboard' | 'project' | 'members'>('dashboard');

  const handleProjectClick = (id: string) => {
    store.selectProject(id);
    setCurrentView('project');
  };

  const handleDashboardClick = () => {
    store.selectProject(null);
    setCurrentView('dashboard');
  };

  const handleMembersClick = () => {
    setCurrentView('members');
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-between hover:bg-muted font-semibold px-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div 
                    className="w-6 h-6 rounded flex-shrink-0" 
                    style={{ backgroundColor: store.activeWorkspace.color }}
                  />
                  <span className="truncate">{store.activeWorkspace.name}</span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                My Workspaces
              </div>
              {store.workspaces.map(w => (
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
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-primary font-medium">
                <Plus className="h-4 w-4 mr-2" />
                Create Workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <div className="space-y-1 mb-6">
            <Button 
              variant={currentView === 'dashboard' ? 'secondary' : 'ghost'} 
              className="w-full justify-start gap-3"
              onClick={handleDashboardClick}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button 
              variant={currentView === 'members' ? 'secondary' : 'ghost'} 
              className="w-full justify-start gap-3"
              onClick={handleMembersClick}
            >
              <Users className="h-4 w-4" />
              Members
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Projects
              <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted" onClick={() => {}}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {store.workspaceProjects.map(p => (
                <Button 
                  key={p.id} 
                  variant={store.activeProject?.id === p.id ? 'secondary' : 'ghost'} 
                  className="w-full justify-start gap-3 font-normal"
                  onClick={() => handleProjectClick(p.id)}
                >
                  <Box className="h-4 w-4" style={{ color: p.color }} />
                  <span className="truncate">{p.name}</span>
                </Button>
              ))}
              {store.workspaceProjects.length === 0 && (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground italic">
                  No projects yet
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t mt-auto">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={store.currentUser.avatarUrl} />
              <AvatarFallback>AR</AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold truncate">{store.currentUser.name}</span>
              <span className="text-xs text-muted-foreground truncate">{store.currentUser.email}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        <header className="h-16 border-b flex items-center justify-between px-6 bg-card/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold font-headline">
              {currentView === 'dashboard' ? 'Workspace Overview' : 
               currentView === 'members' ? 'Team Members' : 
               store.activeProject?.name || 'Project'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search tasks..." className="pl-9 h-9 bg-muted/50 border-none focus-visible:ring-1" />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background p-6">
          {currentView === 'dashboard' && <DashboardView store={store} />}
          {currentView === 'project' && <ProjectView store={store} />}
          {currentView === 'members' && <MembersView store={store} />}
        </main>
      </div>
    </div>
  );
}