import { FirebaseApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { ChatAttachment } from '@/lib/types';

const MAX_BYTES = 15 * 1024 * 1024;

export async function uploadChatAttachment(
  app: FirebaseApp,
  opts: {
    workspaceId: string;
    conversationId: string;
    file: File;
  }
): Promise<ChatAttachment> {
  if (opts.file.size > MAX_BYTES) {
    throw new Error('File must be under 15 MB.');
  }
  const storage = getStorage(app);
  const safeName = opts.file.name.replace(/[^\w.\-()+ ]+/g, '_');
  const path = `workspaces/${opts.workspaceId}/chat/${opts.conversationId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, opts.file, { contentType: opts.file.type || 'application/octet-stream' });
  const url = await getDownloadURL(storageRef);
  return {
    name: opts.file.name,
    url,
    contentType: opts.file.type || 'application/octet-stream',
    size: opts.file.size,
  };
}

export function dmIdFor(userA: string, userB: string): string {
  return [userA, userB].sort().join('_');
}

/** Extract @Display Name mentions that match known members (longest names first). */
export function extractMentionUserIds(
  body: string,
  members: Array<{ userId: string; displayName?: string | null }>
): string[] {
  if (!body || !members?.length) return [];
  const sorted = [...members]
    .filter((m) => m.displayName?.trim())
    .sort((a, b) => (b.displayName || '').length - (a.displayName || '').length);
  const found = new Set<string>();
  const lower = body;
  for (const m of sorted) {
    const name = (m.displayName || '').trim();
    if (!name) continue;
    const token = `@${name}`;
    if (lower.includes(token)) found.add(m.userId);
  }
  return Array.from(found);
}
