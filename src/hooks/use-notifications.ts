
"use client";

import { useMemo } from 'react';
import { query, collection, where, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Notification } from '@/lib/types';

export function useNotifications(max: number = 20) {
  const db = useFirestore();
  const { user, isAuthReady } = useUser();

  // CRITICAL: The query MUST filter by userId to satisfy the Security Rule:
  // allow read: if resource.data.userId == request.auth.uid;
  const notificationsQuery = useMemoFirebase(() => {
    if (!db || !user?.uid || !isAuthReady) return null;
    
    return query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
  }, [db, user?.uid, isAuthReady, max]);

  const { data, isLoading, error } = useCollection<Notification>(notificationsQuery);

  const unreadCount = useMemo(() => {
    return data?.filter(n => !n.read).length || 0;
  }, [data]);

  return {
    notifications: data || [],
    unreadCount,
    isLoading: !isAuthReady || isLoading,
    error
  };
}
