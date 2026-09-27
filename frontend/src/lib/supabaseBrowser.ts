import { createClient, type Session, type User } from "@supabase/supabase-js";

const AUTH_TIMEOUT_MS = 12_000;
let browserClient: ReturnType<typeof createClient> | undefined;

function publicSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();

  if (!rawUrl || !key) {
    throw new Error("MarhamPattii Supabase authentication is not configured.");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("MarhamPattii has an invalid Supabase project URL.");
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
    throw new Error("MarhamPattii must use its dedicated Supabase project URL.");
  }

  return { url: url.origin, key };
}

function getBrowserSupabase() {
  if (browserClient) return browserClient;
  const { url, key } = publicSupabaseConfig();
  browserClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
}

async function withAuthTimeout<T>(operation: Promise<T>, action: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(action + " timed out. Please check your connection and try again.")),
          AUTH_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function assertProviderUser(user: User | null): User {
  if (!user) throw new Error("Please sign in with a provider account.");
  if (user.app_metadata?.role !== "provider") {
    throw new Error("Unauthorized provider role.");
  }
  return user;
}

type ProviderCheckResponse = {
  success?: boolean;
  error?: string;
  code?: string;
};

function friendlySignInError(error: { message?: string; status?: number } | null): string {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }
  if (error?.status === 429 || message.includes("rate limit")) {
    return "Too many sign-in attempts. Please wait a moment and try again.";
  }
  if (message.includes("invalid login credentials") || error?.status === 400) {
    return "Invalid email or password.";
  }
  return "Provider sign-in is unavailable. Please try again.";
}

async function verifyProviderWithServer(accessToken: string): Promise<void> {
  let response: Response;
  try {
    response = await withAuthTimeout(
      fetch("/api/auth/provider", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }),
      "Provider authorization",
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("timed out")) throw error;
    throw new Error("Could not reach the provider authorization service.");
  }

  const payload = await response.json().catch(() => ({})) as ProviderCheckResponse;
  if (!response.ok) {
    if (response.status === 403 || payload.code === "provider_role_required") {
      throw new Error("Unauthorized provider role.");
    }
    if (response.status === 401) {
      throw new Error("Your provider session is invalid or expired.");
    }
    throw new Error(payload.error || "Could not verify provider access.");
  }
}
async function verifyProviderSession(session: Session): Promise<Session> {
  // getUser contacts the configured Supabase Auth server and validates the JWT.
  // This avoids trusting only a stale locally persisted session.
  const { data, error } = await withAuthTimeout(
    getBrowserSupabase().auth.getUser(session.access_token),
    "Provider verification",
  );
  if (error) throw new Error("The provider session is invalid or expired.");
  assertProviderUser(data.user);
  await verifyProviderWithServer(session.access_token);
  return session;
}

export async function currentProviderSession(): Promise<Session | null> {
  const { data, error } = await withAuthTimeout(
    getBrowserSupabase().auth.getSession(),
    "Provider session check",
  );
  if (error) throw new Error("Could not verify the provider session.");
  if (!data.session) return null;
  return verifyProviderSession(data.session);
}

export async function signInProvider(email: string, password: string): Promise<Session> {
  if (!email || !password) throw new Error("Enter your provider email and password.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  const { data, error } = await withAuthTimeout(
    getBrowserSupabase().auth.signInWithPassword({ email, password }),
    "Provider sign-in",
  );
  if (error || !data.session) {
    throw new Error(friendlySignInError(error));
  }

  try {
    return await verifyProviderSession(data.session);
  } catch (error) {
    await getBrowserSupabase().auth.signOut().catch(() => undefined);
    throw error;
  }
}

export async function signOutProvider(): Promise<void> {
  const { error } = await withAuthTimeout(
    getBrowserSupabase().auth.signOut(),
    "Provider sign-out",
  );
  if (error) throw new Error("Could not sign out.");
}

export async function providerAuthorizationHeaders(): Promise<Record<string, string>> {
  const session = await currentProviderSession();
  if (!session) throw new Error("Please sign in with a provider account.");
  return { Authorization: `Bearer ${session.access_token}` };
}
