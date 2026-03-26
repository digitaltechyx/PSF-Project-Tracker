"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Shield, MoreVertical, Trash2, Search, UserPlus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MembersViewProps {
  store: any;
  onInviteClick: () => void;
  isAdmin: boolean;
}

export function MembersView({ store, onInviteClick, isAdmin }: MembersViewProps) {
  const { workspaceMembers, removeMember, currentUser } = store;
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return workspaceMembers;
    const lowerQuery = searchQuery.toLowerCase();
    return workspaceMembers.filter((m: any) => 
      m.displayName?.toLowerCase().includes(lowerQuery) || 
      m.email?.toLowerCase().includes(lowerQuery)
    );
  }, [workspaceMembers, searchQuery]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline">Team Members</h2>
          <p className="text-sm text-muted-foreground">Manage roles and permissions for your workspace.</p>
        </div>
        {isAdmin && (
          <Button className="gap-2 shrink-0" onClick={onInviteClick}>
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search members by name or email..." 
          className="pl-10 h-10 bg-card shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredMembers.map((member: any) => {
              const role = store.activeWorkspace?.memberRoles?.[member.userId] || 'member';
              const isOwner = store.activeWorkspace?.ownerUserId === member.userId;
              
              return (
                <div key={member.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatarUrl} />
                      <AvatarFallback>{member.displayName?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm flex items-center gap-2">
                        {member.displayName}
                        {member.userId === currentUser.id && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">You</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full capitalize">
                      <Shield className="h-3 w-3" />
                      {isOwner ? 'Owner' : role}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive gap-2"
                          disabled={member.userId === currentUser.id || isOwner || !isAdmin}
                          onClick={() => removeMember(member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
            {filteredMembers.length === 0 && (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <p>No members found matching "{searchQuery}"</p>
                <Button variant="link" size="sm" onClick={() => setSearchQuery('')}>Clear search</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {!searchQuery && (
        <div className="bg-primary/5 rounded-xl p-8 text-center space-y-3">
          <Mail className="h-8 w-8 text-primary mx-auto opacity-50" />
          <h3 className="font-semibold">Collaborate with your team</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Invite members to your workspace to assign tasks, share feedback, and track project progress together.
          </p>
        </div>
      )}
    </div>
  );
}
