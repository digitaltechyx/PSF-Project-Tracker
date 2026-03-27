"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
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
import { Loader2, AlertCircle, LogIn, CheckCircle2, Users, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function JoinWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const inviteId = params.inviteId as string;
  const db = useFirestore();
  const auth = useAuth();

  const bgImage = PlaceHolderImages.find(img => img.id === 'auth-bg');

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const [joining, setJoining] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

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
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          setInviteError('This invitation has expired');
          setInviteLoading(false);
          return;
        }

        if (data.status !== 'active') {
          setInviteError('This invitation is no longer active');
          setInviteLoading(false);
          return;
        }

        if (data.maxUses !== 'unlimited' && data.usageCount >= data.maxUses) {
          setInviteError('This invitation has reached its maximum uses');
          setInviteLoading(false);
          return;
        }

        setInvitation({ id: inviteSnap.id, ...data });
        setInviteLoading(false);
      } catch (error: any) {
        setInviteError('Failed to load invitation details');
        setInviteLoading(false);
      }
    }
    fetchInvitation();
  }, [db, inviteId]);

  const handleGoogleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        setSignInError(`Sign in failed: ${error.message}`);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    setSignInError(null);
    try {
      if (authMode === 'signup') {
        if (!name.trim()) throw new Error('Name is required');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setSignInError(error.message);
    } finally {
      setSigningIn(false);
    }
  };

  const handleJoinWorkspace = async () => {
    if (!user || !invitation || !db) return;
    setJoining(true);
    try {
      const workspaceRef = doc(db, 'workspaces', invitation.workspaceId);
      const workspaceSnap = await getDoc(workspaceRef);
      if (!workspaceSnap.exists()) throw new Error('Workspace no longer exists');

      const workspaceData = workspaceSnap.data();
      const isAlreadyMember = workspaceData.memberRoles?.[user.uid];

      if (!isAlreadyMember) {
        // 1. Update Workspace Roles
        await updateDoc(workspaceRef, {
          [`memberRoles.${user.uid}`]: invitation.role || 'member',
          updatedAt: serverTimestamp(),
        });

        // 2. Increment usage
        const inviteRef = doc(db, 'invitations', invitation.id);
        await updateDoc(inviteRef, { usageCount: increment(1) });

        // 3. Create Member Profile
        const memberRef = doc(db, 'workspaces', invitation.workspaceId, 'members', user.uid);
        await setDoc(memberRef, {
          id: user.uid,
          workspaceId: invitation.workspaceId,
          userId: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email?.toLowerCase() || '',
          avatarUrl: user.photoURL || null,
        }, { merge: true });

        // 4. Grant access to target projects (Project-level scoping)
        if (invitation.targetProjectIds && invitation.targetProjectIds.length > 0) {
          for (const projId of invitation.targetProjectIds) {
            const projRef = doc(db, 'workspaces', invitation.workspaceId, 'projects', projId);
            const projSnap = await getDoc(projRef);
            if (projSnap.exists()) {
              const projData = projSnap.data();
              const allowedIds = [...(projData.allowedUserIds || []), user.uid];
              await updateDoc(projRef, { allowedUserIds: Array.from(new Set(allowedIds)) });
            }
          }
        }
      }

      // 5. Sync User Profile
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        id: user.uid,
        email: user.email?.toLowerCase(),
        name: user.displayName || 'User',
        avatarUrl: user.photoURL || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setJoined(true);
      setTimeout(() => router.push('/'), 1500);
    } catch (error: any) {
      setInviteError('Failed to join: ' + (error.message || 'Check your permissions.'));
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || (inviteLoading && !inviteError)) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative flex items-center justify-center p-4">
      <div className="absolute inset-0 z-0">
        <Image src={bgImage?.imageUrl || 'https://picsum.photos/seed/65/1920/1080'} alt="NexusTrack" fill className="object-cover" priority data-ai-hint="modern office" />
        <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" />
      </div>

      <Card className="max-w-md w-full border-none shadow-2xl relative z-10 animate-in fade-in zoom-in duration-300 backdrop-blur-md bg-card/95">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            {joined ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <Users className="h-8 w-8 text-primary" />}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold font-headline">{joined ? 'Welcome!' : 'Join Workspace'}</CardTitle>
            <CardDescription>
              {inviteError ? 'There was a problem' : joined ? 'Redirecting...' : invitation ? `You've been invited to join ${invitation.workspaceName}` : 'Preparing...'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {inviteError ? (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-3 text-sm border border-destructive/20">
              <AlertCircle className="h-5 w-5 shrink-0" /> {inviteError}
            </div>
          ) : !joined ? (
            <div className="space-y-6">
              {!user ? (
                <div className="space-y-6">
                  <Tabs value={authMode} onValueChange={(v: any) => setAuthMode(v)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="login">Login</TabsTrigger>
                      <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>
                    <form onSubmit={handleEmailAuth} className="space-y-4 mt-6">
                      {authMode === 'signup' && (
                        <div className="space-y-2">
                          <Label>Full Name</Label>
                          <Input placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                      </div>
                      {signInError && <div className="text-xs text-destructive">{signInError}</div>}
                      <Button type="submit" className="w-full h-11" disabled={signingIn}>
                        {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : (authMode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />)}
                        {authMode === 'login' ? 'Login & Join' : 'Sign Up & Join'}
                      </Button>
                    </form>
                  </Tabs>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-background/50">
                    <img src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`} className="h-10 w-10 rounded-full" alt="" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-bold truncate">{user.displayName || 'User'}</span>
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                  </div>
                  <Button className="w-full h-11" onClick={handleJoinWorkspace} disabled={joining}>
                    {joining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : `Join ${invitation?.workspaceName}`}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 gap-4">
               <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
               <p className="text-sm text-muted-foreground italic">Setting up your workspace...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
