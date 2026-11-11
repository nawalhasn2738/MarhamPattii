export function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error('Authentication is not configured. Set the public Supabase environment variables.');
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { throw new Error('Authentication has an invalid Supabase URL.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('Use an HTTPS Supabase project origin, or HTTP localhost for local development.');
  }
  // This is configuration validation, NOT token signature verification. Supabase
  // verifies sessions. Never accept a server secret in a browser-public variable.
  let isAnonJwt = false;
  if (key.split('.').length === 3) {
    try {
      const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      isAnonJwt = JSON.parse(atob(payload)).role === 'anon';
    } catch { /* Invalid or privileged credentials fail closed. */ }
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && !isAnonJwt) {
    throw new Error('Configure a public Supabase publishable or anon key. Secret keys are not permitted.');
  }
  return { url: parsed.origin, key };
}
