
"use client";

import { useMemo } from 'react';
import { query, collection, where, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Notification } from '@/lib/types';

/**
 * Hook to fetch notifications for the currently authenticated user in real-time.
 * It enforces the 'userId' filter required by Firestore Security Rules.
 */
export function useNotifications(max: number = 50) {
  const db = useFirestore();
  const { user, isAuthReady } = useUser();

  const notificationsQuery = useMemoFirebase(() => {
    // CRITICAL: We only construct the query if the user is fully authenticated and ready.
    // The query MUST include the 'userId' filter to satisfy the 'read' security rule.
    if (!db || !isAuthReady || !user?.uid) {
      return null;
    }
    
    // Safety check: Ensure uid is a valid non-empty string before creating the query reference.
    if (typeof user.uid !== 'string' || user.uid.length === 0) {
      return null;
    }

    return query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
  }, [db, user?.uid, isAuthReady, max]);

  // useCollection handles the real-time subscription.
  const { data, isLoading, error } = useCollection<Notification>(notificationsQuery);

  const unreadCount = useMemo(() => {
    if (!data) return 0;
    return data.filter(n => !n.read).length;
  }, [data]);

  return {
    notifications: data || [],
    unreadCount,
    isLoading: !isAuthReady || isLoading,
    error
  };
}
