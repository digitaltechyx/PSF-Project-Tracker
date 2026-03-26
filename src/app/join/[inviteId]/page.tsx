"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser, useAuth } from '@/firebase';
import { doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, ShieldCheck, LogIn, AlertTriangle } from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function JoinPage() {
  const { inviteId } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!db || !inviteId) return;
      try {
        const docRef = doc(db, 'invitations', inviteId as string);
        const snap = await getDoc(docRef);
        
        if (!snap.exists()) {
          setError('Invalid or expired invitation link.');
          return;
        }
        
        const data = snap.data();
        
        // Expiry Check
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          setError('This invitation has expired.');
          return;
        }
        
        // Usage Check
        if (data.maxUses !== 'unlimited' && data.usageCount >= data.maxUses) {
          setError('This invitation link has reached its maximum uses.');
          return;
        }

        if (data.status !== 'active') {
          setError('This invitation is no longer active.');
          return;
        }

        setInvite(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [db, inviteId]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError('Login failed. Please try again.');
    }
  };

  const handleJoin = async () => {
    if (!user || !invite || !db) return;
    setJoining(true);
    try {
      const wsRef = doc(db, 'workspaces', invite.workspaceId);
      const wsSnap = await getDoc(wsRef);
      
      if (!wsSnap.exists()) {
        throw new Error('Workspace no longer exists.');
      }

      const wsData = wsSnap.data();
      
      // Update workspace member roles
      const newRoles = { 
        ...wsData.memberRoles, 
        [user.uid]: invite.role 
      };
      await updateDoc(wsRef, { memberRoles: newRoles });

      // Create member document
      const memberRef = doc(db, 'workspaces', invite.workspaceId, 'members', user.uid);
      await setDoc(memberRef, {
        id: user.uid,
        workspaceId: invite.workspaceId,
        userId: user.uid,
        displayName: user.displayName || 'Anonymous',
        email: user.email || '',
        avatarUrl: user.photoURL || null,
      });

      // Update usage count
      const inviteRef = doc(db, 'invitations', inviteId as string);
      await updateDoc(inviteRef, { usageCount: increment(1) });

      router.push('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  if (loading || isUserLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-none shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold font-headline">Join Workspace</CardTitle>
            <CardDescription>
              {error ? 'There was an issue with your invitation' : `You've been invited to join ${invite?.workspaceName}`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-3 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Invited by</span>
                  <span className="font-semibold">{invite.invitedByName}</span>
                </div>
                <div className="flex items-center justify-between text-sm p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Your Role</span>
                  <div className="flex items-center gap-1.5 font-semibold capitalize">
                    {invite.role === 'lead' ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4" />}
                    {invite.role}
                  </div>
                </div>
              </div>

              {!user ? (
                <Button className="w-full gap-2 h-11" onClick={handleLogin}>
                  <LogIn className="h-5 w-5" />
                  Sign in with Google to Join
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <img src={user.photoURL || ''} className="h-10 w-10 rounded-full" alt="" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{user.displayName}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </div>
                  <Button className="w-full h-11" onClick={handleJoin} disabled={joining}>
                    {joining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Accept & Join Workspace'}
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {error && (
            <Button variant="ghost" className="w-full" onClick={() => router.push('/')}>
              Return to NexusTrack
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
