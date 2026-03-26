"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider,
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  increment, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useFirestore, useAuth } from '@/firebase';
import { Loader2, AlertCircle, LogIn, CheckCircle2, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

/**
 * JoinWorkspacePage handles the invitation acceptance process.
 * It uses a dedicated auth listener to ensure the UI reacts instantly after login.
 */
export default function JoinWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const inviteId = params.inviteId as string;
  const db = useFirestore();
  const auth = useAuth();

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Invitation state
  const [invitation, setInvitation] = useState<any>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Action state
  const [joining, setJoining] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [joined, setJoined] = useState(false);

  // 1. Listen for auth state changes to transition UI from login to join
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  // 2. Fetch invitation details on mount
  useEffect(() => {
    async function fetchInvitation() {
      if (!db || !inviteId) return;

      try {
        const inviteRef = doc(db, 'invitations', inviteId);
        const inviteSnap = await getDoc(inviteRef);

        if (!inviteSnap.exists()) {
          setInviteError('Invitation not found or has expired');
          setInviteLoading(false);
          return;
        }

        const data = inviteSnap.data();
        
        // Expiry check
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          setInviteError('This invitation has expired');
          setInviteLoading(false);
          return;
        }

        // Status check
        if (data.status !== 'active') {
          setInviteError('This invitation is no longer active');
          setInviteLoading(false);
          return;
        }

        // Max uses check
        if (data.maxUses !== 'unlimited' && data.usageCount >= data.maxUses) {
          setInviteError('This invitation has reached its maximum uses');
          setInviteLoading(false);
          return;
        }

        setInvitation({ id: inviteSnap.id, ...data });
        setInviteLoading(false);
      } catch (error: any) {
        console.error('Error fetching invitation:', error);
        setInviteError('Failed to load invitation details');
        setInviteLoading(false);
      }
    }

    fetchInvitation();
  }, [db, inviteId]);

  // Handle Google Sign In popup
  const handleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      // Explicitly awaiting ensures we catch specific errors like popup-closed
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      // Gracefully handle "popup closed by user" without crashing the app
      if (error.code === 'auth/popup-closed-by-user') {
        // Just stop the loading state, the user can try again
      } else {
        console.error('Sign in error:', error);
        setInviteError('Sign in failed: ' + (error.message || 'Please try again.'));
      }
    } finally {
      setSigningIn(false);
    }
  };

  // Handle final Join action
  const handleJoinWorkspace = async () => {
    if (!user || !invitation || !db) return;
    setJoining(true);

    try {
      const workspaceRef = doc(db, 'workspaces', invitation.workspaceId);
      const workspaceSnap = await getDoc(workspaceRef);
      
      if (!workspaceSnap.exists()) {
        throw new Error('Workspace no longer exists');
      }

      const workspaceData = workspaceSnap.data();
      const isAlreadyMember = workspaceData.memberRoles?.[user.uid];

      if (!isAlreadyMember) {
        // 1. Update workspace roles to grant access
        await updateDoc(workspaceRef, {
          [`memberRoles.${user.uid}`]: invitation.role || 'member',
          updatedAt: serverTimestamp(),
        });

        // 2. Increment invitation usage (usageCount from backend.json)
        const inviteRef = doc(db, 'invitations', invitation.id);
        await updateDoc(inviteRef, {
          usageCount: increment(1),
        });

        // 3. Create workspace member record for search and list views
        const memberRef = doc(db, 'workspaces', invitation.workspaceId, 'members', user.uid);
        await setDoc(memberRef, {
          id: user.uid,
          workspaceId: invitation.workspaceId,
          userId: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email?.toLowerCase() || '',
          avatarUrl: user.photoURL || null,
        }, { merge: true });
      }

      // 4. Sync global user profile for searchable emails
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        id: user.uid,
        email: user.email?.toLowerCase(),
        name: user.displayName || 'User',
        avatarUrl: user.photoURL,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setJoined(true);
      // Success feedback delay
      setTimeout(() => router.push('/'), 1500);
      
    } catch (error: any) {
      console.error('Error joining workspace:', error);
      setInviteError('Failed to join: ' + (error.message || 'Check your permissions.'));
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || (inviteLoading && !inviteError)) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-none shadow-xl animate-in fade-in zoom-in duration-300">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            {joined ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <Users className="h-8 w-8 text-primary" />}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold font-headline">
              {joined ? 'Welcome!' : 'Join Workspace'}
            </CardTitle>
            <CardDescription>
              {inviteError ? 'There was a problem' : 
               joined ? 'Redirecting to your dashboard...' : 
               invitation ? `You've been invited to join ${invitation.workspaceName}` : 'Preparing...'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {inviteError ? (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-3 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {inviteError}
            </div>
          ) : !joined ? (
            <div className="space-y-6">
              {invitation && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Invited by</span>
                    <span className="font-semibold">{invitation.invitedByName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Your Assigned Role</span>
                    <div className="flex items-center gap-1.5 font-semibold capitalize">
                      {invitation.role === 'lead' ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4" />}
                      {invitation.role}
                    </div>
                  </div>
                </div>
              )}

              {!user ? (
                <div className="space-y-4">
                  <p className="text-xs text-center text-muted-foreground">Please sign in to accept this invitation.</p>
                  <Button className="w-full gap-2 h-11" onClick={handleSignIn} disabled={signingIn}>
                    {signingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                    {signingIn ? 'Signing in...' : 'Sign in with Google'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-card/50">
                    <img src={user.photoURL || ''} className="h-10 w-10 rounded-full" alt="" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-bold truncate">{user.displayName}</span>
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                  </div>
                  <Button className="w-full h-11 text-lg font-semibold" onClick={handleJoinWorkspace} disabled={joining || !invitation}>
                    {joining ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Joining...
                      </>
                    ) : 'Accept & Join Workspace'}
                  </Button>
                  <button 
                    className="w-full text-xs text-muted-foreground hover:underline"
                    onClick={() => auth.signOut()}
                  >
                    Not you? Sign in with a different account
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 gap-4">
               <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
               <p className="text-sm text-muted-foreground italic">Setting up your workspace...</p>
            </div>
          )}
          
          {inviteError && (
            <Button variant="ghost" className="w-full" onClick={() => router.push('/')}>
              Return to Home
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
