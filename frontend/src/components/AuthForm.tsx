'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/browser';
export function AuthForm({ mode, configurationNotice = false }: { mode: 'login' | 'register'; configurationNotice?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const register = mode === 'register';
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    try {
      const client = browserSupabase();
      const result = register
        ? await client.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) {
        const message = result.error.message.toLowerCase();
        throw new Error(message.includes('invalid login') ? 'Email or password is incorrect.' : message.includes('email not confirmed') ? 'Confirm your email before signing in.' : result.error.status === 429 ? 'Too many attempts. Please wait and try again.' : register ? 'Registration could not be completed. Check your details, password requirements, and connection.' : 'Sign-in is unavailable. Check your connection and try again.');
      }
      if (!result.data.session) { setNotice('Check your email for a confirmation link and open it in this same browser. If an account already exists, sign in instead.'); return; }
      router.replace('/dashboard'); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <section className="auth-layout"><div className="auth-story"><p className="eyebrow">YOU’RE PART OF SOMETHING LOCAL.</p><h1>{register ? 'A safer community starts with you.' : 'Good to have you back.'}</h1><p>One account. A shared commitment to care, privacy, and safer choices.</p><div className="auth-footnote">Your trusted role is assigned securely.<br/>It cannot be selected during registration.</div></div><div className="auth-panel"><p className="eyebrow">{register ? 'JOIN MARHAMPATTII' : 'YOUR COMMUNITY ACCOUNT'}</p><h2>{register ? 'Create your account' : 'Sign in'}</h2><p className="subtle">{register ? 'Start with your email and a secure password.' : 'Enter your details to open your dashboard.'}</p><form onSubmit={submit}>
    <label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" disabled={busy}/>
    <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : 1} maxLength={128} required disabled={busy}/>
    {register && <p className="subtle">Use at least 8 characters. Your Supabase project may require a stronger password.</p>}
    {configurationNotice && <p className="alert" role="alert">Authentication configuration or connection is unavailable. Please contact the project maintainer.</p>}
    {error && <p className="alert" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    <button className="button" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account →' : 'Sign in →'}</button>
    </form><p className="auth-switch">{register ? 'Already registered? ' : 'New to the community? '}<Link href={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p><p className="subtle">Never use this platform to delay emergency care.</p></div></section>;
}
