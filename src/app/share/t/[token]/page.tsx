"use client";

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useFirestore, useAuth } from '@/firebase';
import {
  AlertCircle,
  Calendar,
  Loader2,
  Target as TargetIcon,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SubTarget, Target, TargetShare, TargetStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const STATUS_OPTIONS: { value: TargetStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'hold', label: 'Hold' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_CLASS: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-amber-50 text-amber-800 border-amber-200',
  hold: 'bg-orange-50 text-orange-800 border-orange-200',
  complete: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

function normalizeStatus(s?: string): TargetStatus {
  if (s === 'done') return 'complete';
  if (STATUS_OPTIONS.some((o) => o.value === s)) return s as TargetStatus;
  return 'planned';
}

function formatRange(start: string, end: string) {
  try {
    const s = start ? new Date(start + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const e = end ? new Date(end + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    return `${s} → ${e}`;
  } catch {
    return `${start} → ${end}`;
  }
}

export default function SharedTargetPage() {
  const params = useParams();
  const token = params.token as string;
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [share, setShare] = useState<TargetShare | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<TargetStatus>('planned');
  const [subTargets, setSubTargets] = useState<SubTarget[]>([]);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, [auth]);

  const loadShareAndTarget = useCallback(async () => {
    if (!db || !token || !user) return;
    setLoading(true);
    setError(null);
    try {
      const shareSnap = await getDoc(doc(db, 'targetShares', token));
      if (!shareSnap.exists()) {
        setError('This share link is invalid or has been removed.');
        setShare(null);
        setTarget(null);
        setLoading(false);
        return;
      }
      const shareData = { id: shareSnap.id, ...shareSnap.data() } as TargetShare;
      // Support legacy snapshot docs that lack `enabled`
      const enabled = shareData.enabled !== false && (shareData as any).permission !== undefined
        ? shareData.enabled !== false
        : shareData.enabled !== false;

      if (shareData.enabled === false) {
        setError('This share link has been disabled.');
        setShare(shareData);
        setTarget(null);
        setLoading(false);
        return;
      }

      setShare({ ...shareData, enabled: enabled !== false, permission: 'edit', acceptedUserIds: shareData.acceptedUserIds || [] });

      const accepted = (shareData.acceptedUserIds || []).includes(user.uid);
      if (!accepted) {
        setAccepting(true);
        try {
          await updateDoc(doc(db, 'targetShares', token), {
            acceptedUserIds: [...(shareData.acceptedUserIds || []), user.uid],
            enabled: true,
            permission: 'edit',
            updatedAt: new Date().toISOString(),
          });
          setShare((prev) =>
            prev
              ? { ...prev, acceptedUserIds: [...(prev.acceptedUserIds || []), user.uid], enabled: true }
              : prev
          );
        } catch (e) {
          console.error(e);
          setError('Could not accept this share invite. Ask the owner to reshare the link.');
          setAccepting(false);
          setLoading(false);
          return;
        }
        setAccepting(false);
      }

      const targetSnap = await getDoc(
        doc(db, 'workspaces', shareData.workspaceId, 'targets', shareData.targetId)
      );
      if (!targetSnap.exists()) {
        setError('The shared target no longer exists.');
        setTarget(null);
        setLoading(false);
        return;
      }

      const t = { id: targetSnap.id, ...targetSnap.data() } as Target;
      if (t.shareEnabled === false) {
        setError('Sharing for this target has been turned off.');
        setTarget(null);
        setLoading(false);
        return;
      }

      setTarget(t);
      setTitle(t.title || '');
      setDescription(t.description || '');
      setStartDate(t.startDate || '');
      setEndDate(t.endDate || '');
      setStatus(normalizeStatus(t.status));
      setSubTargets(
        (t.subTargets || []).map((s) => ({ ...s, status: normalizeStatus(s.status) }))
      );
    } catch (e) {
      console.error(e);
      setError('Could not load this shared target.');
    } finally {
      setLoading(false);
    }
  }, [db, token, user]);

  useEffect(() => {
    if (user && db && token) {
      loadShareAndTarget();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, db, token, authLoading, loadShareAndTarget]);

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
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
      }
    } catch (e: any) {
      setSignInError(e?.message || 'Authentication failed');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSave = async () => {
    if (!db || !share || !target || !user) return;
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title required' });
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'workspaces', share.workspaceId, 'targets', share.targetId), {
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate,
        status: normalizeStatus(status),
        subTargets,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Target saved' });
      setTarget((prev) =>
        prev
          ? {
              ...prev,
              title: title.trim(),
              description: description.trim(),
              startDate,
              endDate,
              status: normalizeStatus(status),
              subTargets,
            }
          : prev
      );
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-background to-background">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <div className="flex items-center gap-2 text-muted-foreground mb-8">
          <TargetIcon className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.14em]">
            Shared target · edit access
          </span>
        </div>

        {(authLoading || (user && loading) || accepting) && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            {accepting ? 'Accepting invite…' : 'Loading…'}
          </div>
        )}

        {!authLoading && !user && (
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 sm:p-8 space-y-5">
            <div>
              <h1 className="text-xl font-semibold font-headline mb-1">Sign in to open this target</h1>
              <p className="text-sm text-muted-foreground">
                You don’t need to join the workspace. After sign-in you can view and edit this shared target.
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

        {!authLoading && user && !loading && !accepting && error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-3" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {!authLoading && user && !loading && !accepting && target && share && (
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 space-y-5">
              {share.workspaceName && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {share.workspaceName}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn('text-[10px]', STATUS_CLASS[normalizeStatus(status)])}>
                  {STATUS_OPTIONS.find((o) => o.value === normalizeStatus(status))?.label}
                </Badge>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatRange(startDate, endDate)}
                </span>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={8}
                  className="min-h-[140px] resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={normalizeStatus(status)} onValueChange={(v) => setStatus(v as TargetStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              {(subTargets || []).length > 0 && (
                <div className="space-y-2">
                  <Label>Sub-targets</Label>
                  <div className="space-y-2">
                    {subTargets.map((s, i) => (
                      <div key={s.id} className="rounded-xl border border-border/50 p-3 space-y-2">
                        <Input
                          value={s.title}
                          onChange={(e) => {
                            const next = [...subTargets];
                            next[i] = { ...next[i], title: e.target.value };
                            setSubTargets(next);
                          }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="date"
                            value={s.startDate}
                            onChange={(e) => {
                              const next = [...subTargets];
                              next[i] = { ...next[i], startDate: e.target.value };
                              setSubTargets(next);
                            }}
                          />
                          <Input
                            type="date"
                            value={s.endDate}
                            onChange={(e) => {
                              const next = [...subTargets];
                              next[i] = { ...next[i], endDate: e.target.value };
                              setSubTargets(next);
                            }}
                          />
                        </div>
                        <Select
                          value={normalizeStatus(s.status)}
                          onValueChange={(v) => {
                            const next = [...subTargets];
                            next[i] = { ...next[i], status: v as TargetStatus };
                            setSubTargets(next);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
