"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { useFirestore, useAuth } from '@/firebase';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogIn,
  Target as TargetIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TargetTransfer, Workspace } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { acceptTargetTransferInline } from './accept';

export default function SharedTargetTransferPage() {
  const params = useParams();
  const token = params.token as string;
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [transfer, setTransfer] = useState<TargetTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsLoading, setWsLoading] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('');
  const [newWsName, setNewWsName] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState<{ count: number; workspaceName: string } | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, [auth]);

  const loadTransfer = useCallback(async () => {
    if (!db || !token || !user) return;
    setLoading(true);
    setError(null);
    try {
      const snap = await getDoc(doc(db, 'targetTransfers', token));
      if (!snap.exists()) {
        // Legacy live-edit share docs are no longer supported for new flow
        const legacy = await getDoc(doc(db, 'targetShares', token));
        if (legacy.exists()) {
          setError('This old share link is no longer supported. Ask them to share again with a new link.');
        } else {
          setError('This share link is invalid or has been removed.');
        }
        setTransfer(null);
        return;
      }
      setTransfer({ id: snap.id, ...snap.data() } as TargetTransfer);
    } catch (e) {
      console.error(e);
      setError('Could not load this share.');
    } finally {
      setLoading(false);
    }
  }, [db, token, user]);

  const loadWorkspaces = useCallback(async () => {
    if (!db || !user) return;
    setWsLoading(true);
    try {
      const all = await getDocs(collection(db, 'workspaces'));
      const list = all.docs
        .map((d) => ({ id: d.id, ...d.data() } as Workspace))
        .filter(
          (w) =>
            w.ownerUserId === user.uid ||
            ['owner', 'lead', 'member'].includes(w.memberRoles?.[user.uid] || '')
        );
      setWorkspaces(list);
      if (list.length === 1) setWorkspaceId(list[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setWsLoading(false);
    }
  }, [db, user]);

  useEffect(() => {
    if (user && db && token) loadTransfer();
    else if (!authLoading && !user) setLoading(false);
  }, [user, db, token, authLoading, loadTransfer]);

  useEffect(() => {
    if (user && db && transfer) loadWorkspaces();
  }, [user, db, transfer, loadWorkspaces]);

  const alreadyAcceptedHere = useMemo(() => {
    if (!user || !transfer || !workspaceId) return false;
    return (transfer.acceptances || []).some(
      (a) => a.userId === user.uid && a.workspaceId === workspaceId
    );
  }, [user, transfer, workspaceId]);

  const handleGoogle = async () => {
    if (!auth) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: any) {
      setSignInError(e?.message || 'Google sign-in failed');
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!auth || !email || !password) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      }
    } catch (e: any) {
      setSignInError(e?.message || 'Authentication failed');
    } finally {
      setSigningIn(false);
    }
  };

  const createWorkspaceAndAccept = async () => {
    if (!db || !user || !transfer || !newWsName.trim()) {
      toast({ variant: 'destructive', title: 'Enter a workspace name' });
      return;
    }
    setAccepting(true);
    try {
      const wsRef = doc(collection(db, 'workspaces'));
      const now = new Date().toISOString();
      const ws: Workspace = {
        id: wsRef.id,
        name: newWsName.trim(),
        description: '',
        color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
        ownerUserId: user.uid,
        memberRoles: { [user.uid]: 'owner' },
        targetsAllowedUserIds: [user.uid],
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(wsRef, ws);
      await setDoc(doc(db, 'workspaces', wsRef.id, 'members', user.uid), {
        id: user.uid,
        workspaceId: wsRef.id,
        userId: user.uid,
        displayName: user.displayName || 'User',
        email: user.email || '',
        avatarUrl: user.photoURL || null,
        role: 'owner',
      });

      const result = await acceptTargetTransferInline(db, user, token, wsRef.id, transfer);
      setDone({ count: result.count, workspaceName: ws.name });
      toast({ title: 'Targets copied', description: `${result.count} target(s) added to ${ws.name}.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not accept', description: e?.message });
    } finally {
      setAccepting(false);
    }
  };

  const handleAccept = async () => {
    if (!db || !user || !transfer) return;
    if (workspaces.length > 1 && !workspaceId) {
      toast({ variant: 'destructive', title: 'Choose a workspace' });
      return;
    }
    if (workspaces.length === 0) {
      toast({ variant: 'destructive', title: 'Create a workspace first' });
      return;
    }
    const dest = workspaceId || workspaces[0]?.id;
    if (!dest) return;
    if (alreadyAcceptedHere) {
      toast({ title: 'Already copied into this workspace' });
      return;
    }

    setAccepting(true);
    try {
      const result = await acceptTargetTransferInline(db, user, token, dest, transfer);
      const wsName = workspaces.find((w) => w.id === dest)?.name || 'your workspace';
      setDone({ count: result.count, workspaceName: wsName });
      setTransfer((prev) =>
        prev
          ? {
              ...prev,
              acceptances: [
                ...(prev.acceptances || []),
                { userId: user.uid, workspaceId: dest, acceptedAt: new Date().toISOString() },
              ],
            }
          : prev
      );
      toast({ title: 'Targets copied', description: `${result.count} target(s) are now yours in ${wsName}.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not accept', description: e?.message });
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-background to-background">
      <div className="max-w-lg mx-auto px-4 py-10 sm:py-16">
        <div className="flex items-center gap-2 text-muted-foreground mb-8">
          <TargetIcon className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em]">
            Shared targets · copy into your workspace
          </span>
        </div>

        {(authLoading || (user && loading)) && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        )}

        {!authLoading && !user && (
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 sm:p-8 space-y-5">
            <div>
              <h1 className="text-xl font-semibold font-headline mb-1">Sign in to receive targets</h1>
              <p className="text-sm text-muted-foreground">
                After sign-in you’ll copy these targets into a workspace you choose. They become yours.
              </p>
            </div>
            <Button className="w-full gap-2" onClick={handleGoogle} disabled={signingIn}>
              {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Continue with Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or email</span>
              </div>
            </div>
            <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Log in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
            </Tabs>
            {authMode === 'signup' && (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {signInError && <p className="text-sm text-destructive">{signInError}</p>}
            <Button className="w-full" onClick={handleEmailAuth} disabled={signingIn}>
              {signingIn && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {authMode === 'login' ? 'Log in' : 'Create account'}
            </Button>
          </div>
        )}

        {!authLoading && user && !loading && error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-3" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {!authLoading && user && !loading && transfer && !done && (
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 sm:p-8 space-y-5">
            <div>
              <h1 className="text-xl font-semibold font-headline mb-1">
                {transfer.targets.length} target{transfer.targets.length === 1 ? '' : 's'} from {transfer.fromUserName}
              </h1>
              <p className="text-sm text-muted-foreground">
                From workspace “{transfer.fromWorkspaceName}”. Copies will be added to your workspace — originals stay with them.
              </p>
            </div>

            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {transfer.targets.map((t, i) => (
                <li key={i} className="rounded-xl border border-border/50 px-3 py-2.5">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>

            {wsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your workspaces…
              </div>
            ) : workspaces.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You don’t have a workspace yet. Create one to receive these targets.
                </p>
                <div className="space-y-2">
                  <Label>New workspace name</Label>
                  <Input
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    placeholder="My workspace"
                  />
                </div>
                <Button className="w-full" onClick={createWorkspaceAndAccept} disabled={accepting || !newWsName.trim()}>
                  {accepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create workspace & copy targets
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {workspaces.length > 1 ? (
                  <div className="space-y-2">
                    <Label>Copy into which workspace?</Label>
                    <Select value={workspaceId} onValueChange={setWorkspaceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces.map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Will copy into <span className="font-medium text-foreground">{workspaces[0].name}</span>.
                  </p>
                )}

                {alreadyAcceptedHere && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    You already copied these into this workspace.
                  </p>
                )}

                <Button
                  className="w-full"
                  onClick={handleAccept}
                  disabled={accepting || alreadyAcceptedHere || (workspaces.length > 1 && !workspaceId)}
                >
                  {accepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Copy into my Targets
                </Button>
              </div>
            )}
          </div>
        )}

        {done && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600" />
            <h2 className="text-lg font-semibold">
              {done.count} target{done.count === 1 ? '' : 's'} copied
            </h2>
            <p className="text-sm text-muted-foreground">
              They’re now in <span className="font-medium text-foreground">{done.workspaceName}</span> under Targets.
            </p>
            <Button onClick={() => router.push('/')}>Open app</Button>
          </div>
        )}
      </div>
    </div>
  );
}
