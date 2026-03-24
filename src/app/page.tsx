"use client";

import { NexusShell } from '@/components/NexusShell';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();

  // Ensure user document exists in Firestore immediately upon login.
  // This is required for security rules to validate the user's identity path.
  useEffect(() => {
    if (user && db) {
      const userRef = doc(db, 'users', user.uid);
      setDoc(userRef, {
        id: user.uid,
        name: user.displayName || 'User',
        email: user.email,
        avatarUrl: user.photoURL,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  }, [user, db]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  if (isUserLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold font-headline text-primary">NexusTrack</h1>
          <p className="text-muted-foreground">Manage projects with speed and clarity.</p>
        </div>
        <Button size="lg" onClick={handleLogin} className="gap-2">
          <LogIn className="h-5 w-5" />
          Login with Google
        </Button>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <NexusShell />
    </main>
  );
}