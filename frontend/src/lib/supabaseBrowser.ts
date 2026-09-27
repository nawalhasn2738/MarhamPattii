import { createClient, type Session } from "@supabase/supabase-js";

let browserClient: ReturnType<typeof createClient> | undefined;

function getBrowserSupabase() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase browser authentication is not configured.");
  browserClient = createClient(url, key);
  return browserClient;
}

function assertProviderSession(session: Session | null): Session {
  if (!session) throw new Error("Please sign in with a provider account.");
  if (session.user.app_metadata?.role !== "provider") {
    throw new Error("This account does not have provider access.");
  }
  return session;
}

export async function currentProviderSession(): Promise<Session | null> {
  const { data, error } = await getBrowserSupabase().auth.getSession();
  if (error) throw new Error("Could not verify the provider session.");
  if (!data.session) return null;
  return assertProviderSession(data.session);
}

export async function signInProvider(email: string, password: string): Promise<Session> {
  const { data, error } = await getBrowserSupabase().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error("Invalid provider email or password.");

  try {
    return assertProviderSession(data.session);
  } catch (error) {
    await getBrowserSupabase().auth.signOut();
    throw error;
  }
}

export async function signOutProvider(): Promise<void> {
  const { error } = await getBrowserSupabase().auth.signOut();
  if (error) throw new Error("Could not sign out.");
}

export async function providerAuthorizationHeaders(): Promise<Record<string, string>> {
  const session = assertProviderSession((await getBrowserSupabase().auth.getSession()).data.session);
  return { Authorization: `Bearer ${session.access_token}` };
}
