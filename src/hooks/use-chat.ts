"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import {
  useFirestore,
  useFirebaseApp,
  useCollection,
  useMemoFirebase,
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
} from '@/firebase';
import { createNotification } from '@/lib/notifications';
import { dmIdFor, extractMentionUserIds, uploadChatAttachment } from '@/lib/chat-upload';
import type {
  ChatAttachment,
  ChatChannel,
  ChatDm,
  ChatMessage,
  WorkspaceMember,
} from '@/lib/types';

export type ChatSelection =
  | { type: 'channel'; id: string }
  | { type: 'dm'; id: string }
  | null;

export function useChat(opts: {
  workspaceId: string | null | undefined;
  currentUser: { id: string; name: string; avatarUrl?: string | null } | null;
  members: WorkspaceMember[];
  isAuthReady: boolean;
}) {
  const { workspaceId, currentUser, members, isAuthReady } = opts;
  const db = useFirestore();
  const app = useFirebaseApp();
  const [selection, setSelection] = useState<ChatSelection>(null);
  const generalSeededRef = useRef<string | null>(null);

  const channelsQuery = useMemoFirebase(() => {
    if (!db || !workspaceId || !isAuthReady || !currentUser?.id) return null;
    return query(collection(db, 'workspaces', workspaceId, 'channels'), orderBy('name', 'asc'));
  }, [db, workspaceId, isAuthReady, currentUser?.id]);

  const { data: channelsData, isLoading: channelsLoading } = useCollection<ChatChannel>(channelsQuery);

  const channels = useMemo(() => {
    const uid = currentUser?.id;
    const all = channelsData || [];
    if (!uid) return [];
    // Dedupe accidental duplicate "general" channels (keep stable id `general` if present)
    const seenNames = new Set<string>();
    const deduped: ChatChannel[] = [];
    const sorted = [...all].sort((a, b) => {
      if (a.id === 'general') return -1;
      if (b.id === 'general') return 1;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
    for (const c of sorted) {
      const key = (c.name || '').toLowerCase();
      if (key === 'general' && seenNames.has(key)) continue;
      seenNames.add(key);
      if (!c.isPrivate || c.memberUserIds?.includes(uid) || c.createdByUserId === uid) {
        deduped.push(c);
      }
    }
    return deduped;
  }, [channelsData, currentUser?.id]);

  const dmsQuery = useMemoFirebase(() => {
    if (!db || !workspaceId || !isAuthReady || !currentUser?.id) return null;
    return query(
      collection(db, 'workspaces', workspaceId, 'dms'),
      where('participantUserIds', 'array-contains', currentUser.id),
      orderBy('lastMessageAt', 'desc')
    );
  }, [db, workspaceId, isAuthReady, currentUser?.id]);

  const { data: dmsData, isLoading: dmsLoading } = useCollection<ChatDm>(dmsQuery);
  const dms = useMemo(() => dmsData || [], [dmsData]);

  // Ensure a single #general channel (stable doc id so races can't create duplicates)
  useEffect(() => {
    if (!db || !workspaceId || !currentUser?.id || channelsLoading) return;
    if (generalSeededRef.current === workspaceId) return;
    if ((channelsData || []).some((c) => c.id === 'general' || c.name.toLowerCase() === 'general')) {
      generalSeededRef.current = workspaceId;
      return;
    }
    generalSeededRef.current = workspaceId;
    const ref = doc(db, 'workspaces', workspaceId, 'channels', 'general');
    const now = new Date().toISOString();
    const channel: ChatChannel = {
      id: 'general',
      workspaceId,
      name: 'general',
      description: 'Workspace-wide chat',
      isPrivate: false,
      memberUserIds: [],
      createdByUserId: currentUser.id,
      lastMessageAt: null,
      lastMessagePreview: null,
      createdAt: now,
      updatedAt: now,
    };
    setDocumentNonBlocking(ref, channel, { merge: true }).catch((e) => {
      console.error('Failed to create general channel', e);
      generalSeededRef.current = null;
    });
  }, [db, workspaceId, currentUser?.id, channelsData, channelsLoading]);

  useEffect(() => {
    if (!selection && channels.length) {
      const general = channels.find((c) => c.name.toLowerCase() === 'general') || channels[0];
      setSelection({ type: 'channel', id: general.id });
    }
  }, [channels, selection]);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !workspaceId || !selection) return null;
    if (selection.type === 'channel') {
      return query(
        collection(db, 'workspaces', workspaceId, 'channels', selection.id, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(200)
      );
    }
    return query(
      collection(db, 'workspaces', workspaceId, 'dms', selection.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200)
    );
  }, [db, workspaceId, selection]);

  const { data: messagesData, isLoading: messagesLoading } = useCollection<ChatMessage>(messagesQuery);
  const messages = useMemo(() => messagesData || [], [messagesData]);

  const createChannel = useCallback(
    async (data: { name: string; description?: string; isPrivate?: boolean; memberUserIds?: string[] }) => {
      if (!db || !workspaceId || !currentUser) throw new Error('Not ready');
      const name = data.name.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-');
      if (!name) throw new Error('Channel name required');
      const ref = doc(collection(db, 'workspaces', workspaceId, 'channels'));
      const now = new Date().toISOString();
      const isPrivate = Boolean(data.isPrivate);
      const memberUserIds = isPrivate
        ? Array.from(new Set([currentUser.id, ...(data.memberUserIds || [])]))
        : [];
      const channel: ChatChannel = {
        id: ref.id,
        workspaceId,
        name,
        description: data.description?.trim() || '',
        isPrivate,
        memberUserIds,
        createdByUserId: currentUser.id,
        lastMessageAt: null,
        lastMessagePreview: null,
        createdAt: now,
        updatedAt: now,
      };
      await setDocumentNonBlocking(ref, channel, { merge: true });
      setSelection({ type: 'channel', id: ref.id });
      return ref.id;
    },
    [db, workspaceId, currentUser]
  );

  const openDm = useCallback(
    async (otherUserId: string) => {
      if (!db || !workspaceId || !currentUser || otherUserId === currentUser.id) return null;
      const id = dmIdFor(currentUser.id, otherUserId);
      const existing = dms.find((d) => d.id === id);
      if (!existing) {
        const now = new Date().toISOString();
        const participants = [currentUser.id, otherUserId].sort() as [string, string];
        const dm: ChatDm = {
          id,
          workspaceId,
          participantUserIds: participants,
          lastMessageAt: now,
          lastMessagePreview: null,
          createdAt: now,
          updatedAt: now,
        };
        await setDocumentNonBlocking(doc(db, 'workspaces', workspaceId, 'dms', id), dm, { merge: true });
      }
      setSelection({ type: 'dm', id });
      return id;
    },
    [db, workspaceId, currentUser, dms]
  );

  const sendMessage = useCallback(
    async (opts: { body: string; files?: File[] }) => {
      if (!db || !workspaceId || !currentUser || !selection) throw new Error('Select a conversation');
      const body = (opts.body || '').trim();
      const files = opts.files || [];
      if (!body && !files.length) return;

      const conversationId = selection.id;
      const attachments: ChatAttachment[] = [];
      for (const file of files) {
        attachments.push(
          await uploadChatAttachment(app, {
            workspaceId,
            conversationId,
            file,
          })
        );
      }

      const mentionUserIds = extractMentionUserIds(body, members).filter((id) => id !== currentUser.id);
      const now = new Date().toISOString();
      const colPath =
        selection.type === 'channel'
          ? collection(db, 'workspaces', workspaceId, 'channels', selection.id, 'messages')
          : collection(db, 'workspaces', workspaceId, 'dms', selection.id, 'messages');
      const msgRef = doc(colPath);
      const message: ChatMessage = {
        id: msgRef.id,
        workspaceId,
        conversationType: selection.type,
        channelId: selection.type === 'channel' ? selection.id : null,
        dmId: selection.type === 'dm' ? selection.id : null,
        authorUserId: currentUser.id,
        authorName: currentUser.name,
        authorAvatarUrl: currentUser.avatarUrl || null,
        body,
        mentionUserIds,
        attachments,
        createdAt: now,
        updatedAt: now,
      };
      await setDocumentNonBlocking(msgRef, message, { merge: true });

      const preview = body
        ? body.slice(0, 120)
        : attachments.length
          ? `📎 ${attachments[0].name}`
          : '';
      if (selection.type === 'channel') {
        await updateDocumentNonBlocking(doc(db, 'workspaces', workspaceId, 'channels', selection.id), {
          lastMessageAt: now,
          lastMessagePreview: preview,
          updatedAt: now,
        });
      } else {
        await updateDocumentNonBlocking(doc(db, 'workspaces', workspaceId, 'dms', selection.id), {
          lastMessageAt: now,
          lastMessagePreview: preview,
          updatedAt: now,
        });
      }

      // Mentions
      for (const uid of mentionUserIds) {
        createNotification(db, {
          userId: uid,
          actorId: currentUser.id,
          actorName: currentUser.name,
          type: 'chat_mention',
          title: 'Mentioned in chat',
          message: `${currentUser.name} mentioned you: ${preview || 'new message'}`,
          workspaceId,
          channelId: selection.type === 'channel' ? selection.id : undefined,
          dmId: selection.type === 'dm' ? selection.id : undefined,
        });
      }

      // DM notify other participant
      if (selection.type === 'dm') {
        const dm = dms.find((d) => d.id === selection.id);
        const other = dm?.participantUserIds?.find((id) => id !== currentUser.id);
        if (other && !mentionUserIds.includes(other)) {
          createNotification(db, {
            userId: other,
            actorId: currentUser.id,
            actorName: currentUser.name,
            type: 'chat_dm',
            title: 'New direct message',
            message: `${currentUser.name}: ${preview || 'sent an attachment'}`,
            workspaceId,
            dmId: selection.id,
          });
        }
      }
    },
    [db, app, workspaceId, currentUser, selection, members, dms]
  );

  return {
    channels,
    dms,
    channelsLoading,
    dmsLoading,
    messages,
    messagesLoading,
    selection,
    setSelection,
    createChannel,
    openDm,
    sendMessage,
  };
}
