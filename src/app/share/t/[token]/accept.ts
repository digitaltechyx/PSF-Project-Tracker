import {
  collection,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { SubTarget, Target, TargetTransfer, TargetTransferAcceptance, Workspace } from '@/lib/types';

export async function acceptTargetTransferInline(
  db: Firestore,
  user: User,
  token: string,
  destinationWorkspaceId: string,
  transfer: TargetTransfer
) {
  if (!transfer.targets?.length) throw new Error('Nothing to copy.');

  const already = (transfer.acceptances || []).some(
    (a) => a.userId === user.uid && a.workspaceId === destinationWorkspaceId
  );
  if (already) throw new Error('You already copied these targets into that workspace.');

  const wsSnap = await getDoc(doc(db, 'workspaces', destinationWorkspaceId));
  if (!wsSnap.exists()) throw new Error('Workspace not found.');
  const ws = wsSnap.data() as Workspace;

  const isDestAdmin =
    ws.ownerUserId === user.uid ||
    ws.memberRoles?.[user.uid] === 'owner' ||
    ws.memberRoles?.[user.uid] === 'lead';

  if (!isDestAdmin) {
    const allowed = ws.targetsAllowedUserIds || [];
    if (!allowed.includes(user.uid)) {
      await updateDoc(doc(db, 'workspaces', destinationWorkspaceId), {
        targetsAllowedUserIds: [...allowed, user.uid],
        updatedAt: new Date().toISOString(),
      });
    }
  }

  for (const t of transfer.targets) {
    const ref = doc(collection(db, 'workspaces', destinationWorkspaceId, 'targets'));
    const subTargets: SubTarget[] = (t.subTargets || []).map((s, i) => ({
      id: s.id || `st_${Date.now().toString(36)}_${i}`,
      title: s.title,
      startDate: s.startDate,
      endDate: s.endDate,
      status: s.status === 'done' ? 'complete' : s.status || 'planned',
    }));
    const payload: Target = {
      id: ref.id,
      workspaceId: destinationWorkspaceId,
      title: t.title,
      description: t.description || '',
      startDate: t.startDate,
      endDate: t.endDate,
      status: t.status === 'done' ? 'complete' : t.status || 'planned',
      subTargets,
      createdByUserId: user.uid,
      copiedFromTransferId: token,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(ref, payload, { merge: true });
  }

  const acceptance: TargetTransferAcceptance = {
    userId: user.uid,
    workspaceId: destinationWorkspaceId,
    acceptedAt: new Date().toISOString(),
  };

  await updateDoc(doc(db, 'targetTransfers', token), {
    acceptances: [...(transfer.acceptances || []), acceptance],
    updatedAt: new Date().toISOString(),
  });

  return { count: transfer.targets.length, workspaceId: destinationWorkspaceId };
}
