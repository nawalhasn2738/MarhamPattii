'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/browser';
export function SignOut() {
  const router = useRouter();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <div><button className="button secondary" disabled={busy} onClick={async () => {
    setBusy(true); setError('');
    try { const { error } = await browserSupabase().auth.signOut(); if (error) throw error; router.replace('/login'); router.refresh(); }
    catch { setError('Could not sign out. Try again.'); setBusy(false); }
  }}>{busy ? 'Signing out…' : 'Sign out'}</button>{error && <p role="alert">{error}</p>}</div>;
}
