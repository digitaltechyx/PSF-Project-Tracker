"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Hash,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Paperclip,
  Users,
  Loader2,
  X,
  FileText,
  AtSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@/hooks/use-chat';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import type { ChatMessage, WorkspaceMember } from '@/lib/types';

function renderBody(body: string, members: WorkspaceMember[]) {
  if (!body) return null;
  const names = members
    .map((m) => m.displayName?.trim())
    .filter(Boolean)
    .sort((a, b) => (b || '').length - (a || '').length) as string[];
  if (!names.length) return <span className="whitespace-pre-wrap break-words">{body}</span>;

  const pattern = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g');
  const parts = body.split(pattern);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.startsWith('@') && names.some((n) => `@${n}` === part) ? (
          <span key={i} className="rounded bg-sky-100 text-sky-800 px-1 py-0.5 text-[0.95em] font-medium">
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}

export function ChatView({ store }: { store: any }) {
  const {
    activeWorkspace,
    workspaceMembers,
    currentUser,
  } = store;
  const { isAuthReady } = useUser();
  const { toast } = useToast();
  const members: WorkspaceMember[] = workspaceMembers || [];

  const chat = useChat({
    workspaceId: activeWorkspace?.id,
    currentUser: currentUser
      ? { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl }
      : null,
    members,
    isAuthReady,
  });

  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [channelPrivate, setChannelPrivate] = useState(false);
  const [channelMembers, setChannelMembers] = useState<string[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const otherMembers = useMemo(
    () => members.filter((m) => m.userId !== currentUser?.id),
    [members, currentUser?.id]
  );

  const activeChannel = useMemo(
    () =>
      chat.selection?.type === 'channel'
        ? chat.channels.find((c) => c.id === chat.selection!.id)
        : null,
    [chat.selection, chat.channels]
  );

  const activeDm = useMemo(
    () =>
      chat.selection?.type === 'dm' ? chat.dms.find((d) => d.id === chat.selection!.id) : null,
    [chat.selection, chat.dms]
  );

  const dmPeer = useMemo(() => {
    if (!activeDm || !currentUser) return null;
    const otherId = activeDm.participantUserIds.find((id) => id !== currentUser.id);
    return members.find((m) => m.userId === otherId) || null;
  }, [activeDm, currentUser, members]);

  const headerTitle = activeChannel
    ? `# ${activeChannel.name}`
    : dmPeer
      ? dmPeer.displayName || dmPeer.email || 'Direct message'
      : 'Chat';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages.length, chat.selection?.id]);

  const mentionCandidates = useMemo(() => {
    const q = mentionFilter.toLowerCase();
    return otherMembers.filter(
      (m) =>
        !q ||
        (m.displayName || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q)
    );
  }, [otherMembers, mentionFilter]);

  const onBodyChange = (value: string) => {
    setBody(value);
    const at = value.lastIndexOf('@');
    if (at >= 0) {
      const after = value.slice(at + 1);
      if (!after.includes(' ') && after.length <= 40) {
        setMentionOpen(true);
        setMentionFilter(after);
        return;
      }
    }
    setMentionOpen(false);
    setMentionFilter('');
  };

  const insertMention = (m: WorkspaceMember) => {
    const at = body.lastIndexOf('@');
    const name = m.displayName || m.email || 'user';
    const next = at >= 0 ? `${body.slice(0, at)}@${name} ` : `${body}@${name} `;
    setBody(next);
    setMentionOpen(false);
    setMentionFilter('');
  };

  const handleSend = async () => {
    if (!body.trim() && !files.length) return;
    setSending(true);
    try {
      await chat.sendMessage({ body, files });
      setBody('');
      setFiles([]);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not send', description: e?.message });
    } finally {
      setSending(false);
    }
  };

  const handleCreateChannel = async () => {
    try {
      await chat.createChannel({
        name: channelName,
        description: channelDesc,
        isPrivate: channelPrivate,
        memberUserIds: channelMembers,
      });
      setChannelOpen(false);
      setChannelName('');
      setChannelDesc('');
      setChannelPrivate(false);
      setChannelMembers([]);
      toast({ title: 'Channel created' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not create channel', description: e?.message });
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[480px] rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden flex animate-in fade-in duration-300">
      {/* Left rail */}
      <aside className="w-64 shrink-0 border-r border-border/60 bg-muted/20 flex flex-col">
        <div className="p-3 border-b border-border/50 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Channels</p>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChannelOpen(true)} title="New channel">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {chat.channelsLoading && (
              <p className="text-xs text-muted-foreground px-2 py-3">Loading…</p>
            )}
            {chat.channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => chat.setSelection({ type: 'channel', id: c.id })}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-left hover:bg-muted/60',
                  chat.selection?.type === 'channel' && chat.selection.id === c.id && 'bg-muted font-medium'
                )}
              >
                {c.isPrivate ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Hash className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>

          <div className="px-3 pt-4 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Direct</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Message someone">
                  <Users className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto">
                {otherMembers.length === 0 ? (
                  <DropdownMenuItem disabled>No other members</DropdownMenuItem>
                ) : (
                  otherMembers.map((m) => (
                    <DropdownMenuItem key={m.userId} onSelect={() => chat.openDm(m.userId)}>
                      {m.displayName || m.email}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="p-2 space-y-0.5 pb-4">
            {chat.dms.map((d) => {
              const otherId = d.participantUserIds.find((id) => id !== currentUser?.id);
              const peer = members.find((m) => m.userId === otherId);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => chat.setSelection({ type: 'dm', id: d.id })}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-left hover:bg-muted/60',
                    chat.selection?.type === 'dm' && chat.selection.id === d.id && 'bg-muted font-medium'
                  )}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={peer?.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(peer?.displayName || '?').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{peer?.displayName || peer?.email || 'Member'}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b border-border/60 px-4 flex items-center gap-2 shrink-0">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="font-semibold truncate">{headerTitle}</h2>
            {activeChannel?.description ? (
              <p className="text-[11px] text-muted-foreground truncate">{activeChannel.description}</p>
            ) : null}
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="py-4 space-y-4 max-w-3xl mx-auto">
            {chat.messagesLoading && (
              <div className="flex justify-center py-10 text-muted-foreground gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
              </div>
            )}
            {!chat.messagesLoading && chat.messages.length === 0 && (
              <div className="text-center py-16 text-sm text-muted-foreground">
                No messages yet. Say hello, @mention someone, or attach a file.
              </div>
            )}
            {chat.messages.map((msg: ChatMessage) => (
              <div key={msg.id} className="flex gap-3">
                <Avatar className="h-9 w-9 mt-0.5">
                  <AvatarImage src={msg.authorAvatarUrl || undefined} />
                  <AvatarFallback>{(msg.authorName || '?').charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{msg.authorName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}
                    </span>
                  </div>
                  {msg.body ? (
                    <div className="text-sm mt-0.5">{renderBody(msg.body, members)}</div>
                  ) : null}
                  {msg.attachments?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.attachments.map((a, i) => (
                        <a
                          key={i}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs hover:bg-muted/60"
                        >
                          {a.contentType?.startsWith('image/') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.url} alt={a.name} className="h-16 w-16 object-cover rounded" />
                          ) : (
                            <>
                              <FileText className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[160px]">{a.name}</span>
                            </>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 p-3 relative">
          {mentionOpen && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl border border-border/60 bg-card shadow-lg max-h-40 overflow-y-auto z-10">
              {mentionCandidates.slice(0, 8).map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/60"
                  onClick={() => insertMention(m)}
                >
                  <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{m.displayName || m.email}</span>
                </button>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1 pr-1">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button
                    type="button"
                    className="ml-1 rounded hover:bg-muted p-0.5"
                    onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files || []);
                setFiles((prev) => [...prev, ...list].slice(0, 5));
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => fileRef.current?.click()}
              disabled={!chat.selection || sending}
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              placeholder={chat.selection ? 'Message… Use @ to mention' : 'Select a channel or DM'}
              rows={2}
              className="min-h-[44px] resize-none"
              disabled={!chat.selection || sending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              className="shrink-0 gap-1.5"
              onClick={handleSend}
              disabled={!chat.selection || sending || (!body.trim() && !files.length)}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={channelOpen} onOpenChange={setChannelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New channel</DialogTitle>
            <DialogDescription>Create a group channel for this workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. design"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional"
                value={channelDesc}
                onChange={(e) => setChannelDesc(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={channelPrivate}
                onCheckedChange={(v) => setChannelPrivate(Boolean(v))}
              />
              Private channel (invite specific members)
            </label>
            {channelPrivate && (
              <div className="max-h-40 overflow-y-auto space-y-2 border rounded-xl p-2">
                {otherMembers.map((m) => {
                  const checked = channelMembers.includes(m.userId);
                  return (
                    <label key={m.userId} className="flex items-center gap-2 text-sm px-1 py-1">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          setChannelMembers((ids) =>
                            v ? [...ids, m.userId] : ids.filter((id) => id !== m.userId)
                          )
                        }
                      />
                      {m.displayName || m.email}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChannelOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateChannel} disabled={!channelName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
