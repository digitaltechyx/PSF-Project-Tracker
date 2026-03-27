"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Search, 
  Link as LinkIcon, 
  Mail, 
  Copy, 
  Check, 
  Loader2, 
  UserPlus,
  Box
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

export function InviteMembersModal({ 
  isOpen, 
  onOpenChange, 
  store 
}: { 
  isOpen: boolean, 
  onOpenChange: (open: boolean) => void, 
  store: any 
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('link');
  const [copying, setCopying] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  
  // Link State
  const [role, setRole] = useState<'member' | 'lead'>('member');
  const [expires, setExpires] = useState<string>('7');
  const [maxUses, setMaxUses] = useState<string>('unlimited');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Search State
  const [searchEmail, setSearchEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab !== 'email' || !searchEmail.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      if (searchEmail.trim().length >= 2) {
        setIsSearching(true);
        try {
          const users = await store.searchUsersByEmail(searchEmail);
          setSearchResults(users);
        } catch (error) {
          console.error("Search failed:", error);
        } finally {
          setIsSearching(false);
        }
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchEmail, activeTab, store]);

  const handleCreateLink = async () => {
    setIsGenerating(true);
    try {
      const inviteId = await store.createInviteLink({
        role,
        expiresDays: expires === 'never' ? 'never' : parseInt(expires),
        maxUses: maxUses === 'unlimited' ? 'unlimited' : parseInt(maxUses),
        targetProjectIds: selectedProjects
      });
      const link = `${window.location.origin}/join/${inviteId}`;
      setInviteLink(link);
      toast({ title: 'Invite link created!' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleProject = (id: string) => {
    setSelectedProjects(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleAddDirect = async (user: any, targetRole: 'member' | 'lead') => {
    try {
      await store.directAddMember(user, targetRole);
      toast({ title: 'Member added!', description: `${user.name || user.email} is now a ${targetRole}.` });
      setSearchResults([]);
      setSearchEmail('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const copyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
      toast({ title: 'Link copied to clipboard' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite Members
          </DialogTitle>
          <DialogDescription>
            Grow your team by sharing a link or adding them directly.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="gap-2">
              <LinkIcon className="h-4 w-4" />
              Invite Link
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Add by Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-6 py-4">
            {!inviteLink ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Assign Role</Label>
                    <Select value={role} onValueChange={(v: any) => setRole(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Expires In</Label>
                    <Select value={expires} onValueChange={setExpires}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Day</SelectItem>
                        <SelectItem value="7">7 Days</SelectItem>
                        <SelectItem value="30">30 Days</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Box className="h-3 w-3" /> Target Projects (Optional)
                  </Label>
                  <p className="text-[10px] text-muted-foreground pb-2">If role is Member, they will only see these projects.</p>
                  <ScrollArea className="h-[120px] rounded-md border p-2">
                    <div className="space-y-2">
                      {store.workspaceProjects.map((p: any) => (
                        <div key={p.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`proj-${p.id}`} 
                            checked={selectedProjects.includes(p.id)} 
                            onCheckedChange={() => handleToggleProject(p.id)}
                          />
                          <label 
                            htmlFor={`proj-${p.id}`} 
                            className="text-xs font-medium leading-none cursor-pointer"
                          >
                            {p.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="space-y-2">
                  <Label>Max Uses</Label>
                  <Select value={maxUses} onValueChange={setMaxUses}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Use</SelectItem>
                      <SelectItem value="5">5 Uses</SelectItem>
                      <SelectItem value="25">25 Uses</SelectItem>
                      <SelectItem value="unlimited">Unlimited</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreateLink} disabled={isGenerating}>
                  {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Invite Link
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg border space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Shareable Link</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={inviteLink} className="bg-background" />
                    <Button variant="outline" size="icon" onClick={copyLink}>
                      {copying ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Button variant="link" onClick={() => setInviteLink(null)}>Create another link</Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="email" className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Type an email to search..." 
                  className="pl-9" 
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                />
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto min-h-[100px]">
                {isSearching && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-sm">Searching...</span>
                  </div>
                )}
                
                {!isSearching && searchResults.map(user => {
                  const isAlreadyMember = store.activeWorkspace?.memberRoles?.[user.id] !== undefined;
                  return (
                    <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.avatarUrl} />
                          <AvatarFallback>{user.name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{user.name || 'User'}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {isAlreadyMember ? (
                          <Badge variant="secondary">Member</Badge>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" className="h-8 px-2 text-[10px]" onClick={() => handleAddDirect(user, 'member')}>
                              Add Member
                            </Button>
                            <Button size="sm" variant="secondary" className="h-8 px-2 text-[10px]" onClick={() => handleAddDirect(user, 'lead')}>
                              Add Lead
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {!isSearching && searchResults.length === 0 && searchEmail.length >= 2 && (
                  <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                    No results for "{searchEmail}"
                  </div>
                )}
                
                {!isSearching && searchEmail.length < 2 && (
                  <div className="text-center py-6 text-muted-foreground text-xs italic">
                    Type at least 2 characters to search
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
