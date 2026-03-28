
import { Firestore, collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase';
import { Notification, NotificationType } from './types';

export async function createNotification(
  db: Firestore,
  data: Omit<Notification, 'id' | 'createdAt' | 'read'>
) {
  // Don't notify yourself
  if (data.userId === data.actorId) return;

  const notifRef = doc(collection(db, 'notifications'));
  const notification: Notification = {
    ...data,
    id: notifRef.id,
    read: false,
    createdAt: new Date().toISOString(),
  };

  return setDocumentNonBlocking(notifRef, notification, { merge: true });
}

export async function notifyTaskAssigned(
  db: Firestore,
  recipientId: string,
  actor: { id: string; name: string },
  task: { id: string; title: string; workspaceId: string; projectId: string }
) {
  return createNotification(db, {
    userId: recipientId,
    actorId: actor.id,
    actorName: actor.name,
    type: 'task_assigned',
    title: 'New Task Assigned',
    message: `${actor.name} assigned you to "${task.title}"`,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    taskId: task.id,
  });
}

export async function notifyTaskUpdated(
  db: Firestore,
  recipientId: string,
  actor: { id: string; name: string },
  task: { id: string; title: string; workspaceId: string; projectId: string },
  changes: string[]
) {
  if (changes.length === 0) return;
  
  const changesText = changes.length > 1 
    ? `${changes.length} changes were made`
    : `${changes[0]} was updated`;

  return createNotification(db, {
    userId: recipientId,
    actorId: actor.id,
    actorName: actor.name,
    type: 'task_updated',
    title: 'Task Updated',
    message: `${actor.name} updated "${task.title}": ${changesText}`,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    taskId: task.id,
  });
}
