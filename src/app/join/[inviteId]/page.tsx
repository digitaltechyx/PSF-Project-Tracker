
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

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Invitation state
  const [invitation, setInvitation] = useState<any>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Action state
  const [joining, setJoining] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    if (!auth) return;
    console.log('[JoinPage] Setting up auth listener...');
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('[JoinPage] Auth state changed:', currentUser?.email || 'no user');
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  // Fetch invitation details
  useEffect(() => {
    async function fetchInvitation() {
      if (!db || !inviteId) return;
      try {
        console.log('[JoinPage] Fetching invitation:', inviteId);
        const inviteRef = doc(db, 'invitations', inviteId);
        const inviteSnap = await getDoc(inviteRef);

        if (!inviteSnap.exists()) {
          setInviteError('Invitation not found or has expired');
          setInviteLoading(false);
          return;
        }

        const data = inviteSnap.data();
        console.log('[JoinPage] Invitation data:', data);

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
        console.error('[JoinPage] Error loading invitation:', error);
        setInviteError('Failed to load invitation details');
        setInviteLoading(false);
      }
    }
    fetchInvitation();
  }, [db, inviteId]);

  const handleGoogleSignIn = async () => {
    if (signingIn) return;
    console.log('[JoinPage] Starting Google sign in...');
    setSigningIn(true);
    setSignInError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      console.log('[JoinPage] Sign in SUCCESS:', result.user.email);
    } catch (error: any) {
      console.error('[JoinPage] Sign in error:', error);
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
        console.log('[JoinPage] Sign up SUCCESS:', userCredential.user.email);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('[JoinPage] Login SUCCESS:', userCredential.user.email);
      }
    } catch (error: any) {
      console.error('[JoinPage] Email Auth error:', error);
      let message = 'Authentication failed.';
      if (error.code === 'auth/invalid-credential') message = 'Invalid email or password.';
      else if (error.code === 'auth/email-already-in-use') message = 'This email is already registered.';
      else if (error.code === 'auth/weak-password') message = 'Password should be at least 6 characters.';
      else message = error.message;
      setSignInError(message);
    } finally {
      setSigningIn(false);
    }
  };

  const handleJoinWorkspace = async () => {
    if (!user || !invitation || !db) return;
    console.log('[JoinPage] Joining workspace:', invitation.workspaceName);
    setJoining(true);
    try {
      const workspaceRef = doc(db, 'workspaces', invitation.workspaceId);
      const workspaceSnap = await getDoc(workspaceRef);
      if (!workspaceSnap.exists()) throw new Error('Workspace no longer exists');

      const workspaceData = workspaceSnap.data();
      const isAlreadyMember = workspaceData.memberRoles?.[user.uid];

      if (!isAlreadyMember) {
        await updateDoc(workspaceRef, {
          [`memberRoles.${user.uid}`]: invitation.role || 'member',
          updatedAt: serverTimestamp(),
        });
        const inviteRef = doc(db, 'invitations', invitation.id);
        await updateDoc(inviteRef, { usageCount: increment(1) });
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

      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        id: user.uid,
        email: user.email?.toLowerCase(),
        name: user.displayName || 'User',
        avatarUrl: user.photoURL || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setJoined(true);
      console.log('[JoinPage] Joined successfully, redirecting...');
      setTimeout(() => router.push('/'), 1500);
    } catch (error: any) {
      console.error('[JoinPage] Join error:', error);
      setInviteError('Failed to join: ' + (error.message || 'Check your permissions.'));
    } finally {
      setJoining(false);
    }
  };

  console.log('[JoinPage] Render - user:', user?.email, 'authLoading:', authLoading);

  if (authLoading || (inviteLoading && !inviteError)) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative flex items-center justify-center p-4">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0">
        <Image 
          src={bgImage?.imageUrl || 'https://picsum.photos/seed/65/1920/1080'} 
          alt="NexusTrack Background" 
          fill 
          className="object-cover"
          priority
          data-ai-hint={bgImage?.imageHint || "modern office"}
        />
        <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" />
      </div>

      <Card className="max-w-md w-full border-none shadow-2xl relative z-10 animate-in fade-in zoom-in duration-300 backdrop-blur-md bg-card/95">
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
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-3 text-sm border border-destructive/20">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {inviteError}
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
                          <Label htmlFor="join-name">Full Name</Label>
                          <Input 
                            id="join-name" 
                            placeholder="Jane Doe" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            required 
                            className="bg-background/50"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="join-email">Email</Label>
                        <Input 
                          id="join-email" 
                          type="email" 
                          placeholder="jane@example.com" 
                          value={email} 
                          onChange={(e) => setEmail(e.target.value)} 
                          required 
                          className="bg-background/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="join-password">Password</Label>
                        <Input 
                          id="join-password" 
                          type="password" 
                          placeholder="••••••••" 
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)} 
                          required 
                          className="bg-background/50"
                        />
                      </div>

                      {signInError && (
                        <div className="flex items-center gap-2 p-3 text-xs bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {signInError}
                        </div>
                      )}

                      <Button type="submit" className="w-full gap-2 h-11" disabled={signingIn}>
                        {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                         authMode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                        {authMode === 'login' ? 'Login & Join' : 'Sign Up & Join'}
                      </Button>
                    </form>
                  </Tabs>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full h-11 gap-2 bg-background/50" onClick={handleGoogleSignIn} disabled={signingIn}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </Button>
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
                  <Button className="w-full h-11 text-lg font-semibold" onClick={handleJoinWorkspace} disabled={joining || !invitation}>
                    {joining ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Joining...
                      </>
                    ) : `Join ${invitation?.workspaceName}`}
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
        </CardContent>
      </Card>
    </div>
  );
}
