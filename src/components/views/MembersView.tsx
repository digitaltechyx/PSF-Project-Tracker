"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Shield, MoreVertical, Trash2, Search, UserPlus, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface MembersViewProps {
  store: any;
  onInviteClick: () => void;
  isAdmin: boolean;
}

export function MembersView({ store, onInviteClick, isAdmin }: MembersViewProps) {
  const {
    workspaceMembers,
    removeMember,
    currentUser,
    isWorkspacesLoading,
    activeWorkspace,
    workspaceInvitations,
    cancelInvitation,
  } = store;
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = useMemo(() => {
    const all = [
      ...(workspaceMembers || []),
      ...(workspaceInvitations || []).map((inv: any) => ({
        id: `invite-${inv.id}`,
        userId: `invite-${inv.id}`,
        isInvite: true,
        inviteId: inv.id,
        displayName: inv.invitedEmail,
        email: `Invited as ${inv.role} by ${inv.invitedByName}`,
        role: inv.role,
        avatarUrl: null,
      })),
    ];
    if (!searchQuery.trim()) return all;
    const lowerQuery = searchQuery.toLowerCase();
    return all.filter(
      (m: any) =>
        (m.displayName || '').toLowerCase().includes(lowerQuery) ||
        (m.email || '').toLowerCase().includes(lowerQuery)
    );
  }, [workspaceMembers, workspaceInvitations, searchQuery]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="page-subheading">
            Manage roles and access for {activeWorkspace?.name || 'this workspace'}.
          </p>
        </div>
        {isAdmin && (
          <Button className="gap-2 shrink-0 shadow-sm" onClick={onInviteClick}>
            <UserPlus className="h-4 w-4" />
            Invite member
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          className="pl-10 h-11 bg-card border-border/60 shadow-sm rounded-xl"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Card className="border-border/60 shadow-sm overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {filteredMembers.map((member: any) => {
              const userId = member.userId || member.id;
              const isOwner = activeWorkspace?.ownerUserId === userId;

              return (
                <div
                  key={userId}
                  className={cn(
                    'flex items-center justify-between p-4 hover:bg-muted/30 transition-colors',
                    member.isInvite && 'opacity-80'
                  )}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar className="h-10 w-10 border border-border/60">
                      <AvatarImage src={member.avatarUrl} />
                      <AvatarFallback className="font-bold bg-muted">
                        {member.isInvite ? (
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          (member.displayName || '?').charAt(0).toUpperCase()
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                        <span className="truncate">{member.displayName}</span>
                        {userId === currentUser?.id && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                            You
                          </span>
                        )}
                        {member.isInvite && (
                          <span className="text-[9px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Pending
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {member.email ||
                          (member.displayName === 'Pending Sync...'
                            ? 'Initializing...'
                            : 'No email provided')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/80 px-2.5 py-1 rounded-full capitalize">
                      {member.isInvite ? (
                        <>
                          <Mail className="h-3 w-3" />
                          {member.role}
                        </>
                      ) : (
                        <>
                          <Shield className="h-3 w-3" />
                          {isOwner ? 'Owner' : member.role}
                        </>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.isInvite ? (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive gap-2"
                            disabled={!isAdmin}
                            onClick={() => cancelInvitation(member.inviteId)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Cancel invite
                          </DropdownMenuItem>
                        ) : (
                          <>
                            {isAdmin && !isOwner && userId !== currentUser?.id && (
                              <>
                                <DropdownMenuItem
                                  disabled={member.role === 'lead'}
                                  onClick={() => store.updateMemberRole(userId, 'lead')}
                                >
                                  Make Lead
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={member.role === 'member'}
                                  onClick={() => store.updateMemberRole(userId, 'member')}
                                >
                                  Make Member
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive gap-2"
                              disabled={userId === currentUser?.id || isOwner || !isAdmin}
                              onClick={() => removeMember(userId)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove member
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
            {filteredMembers.length === 0 && !isWorkspacesLoading && (
              <div className="p-12 text-center text-muted-foreground space-y-3">
                <Search className="h-8 w-8 mx-auto opacity-20" />
                <p>No members found matching &quot;{searchQuery}&quot;</p>
                <Button variant="link" size="sm" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              </div>
            )}
            {isWorkspacesLoading && (
              <div className="p-12 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-50" />
                <p className="text-sm text-muted-foreground italic">Updating team list…</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
