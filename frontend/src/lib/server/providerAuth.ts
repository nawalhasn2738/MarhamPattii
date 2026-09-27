import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { requiredServerEnv } from "@/lib/server/config";

export class ProviderAuthError extends Error {
  constructor(message: string, readonly status: 401 | 403) {
    super(message);
    this.name = "ProviderAuthError";
  }
}


function publicSupabaseKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? requiredServerEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export function createServiceSupabaseClient(): SupabaseClient {
  return createClient(
    requiredServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function requireProvider(request: Request): Promise<{ user: User; supabase: SupabaseClient }> {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new ProviderAuthError("Provider authentication is required.", 401);
  }

  const authClient = createClient(requiredServerEnv("NEXT_PUBLIC_SUPABASE_URL"), publicSupabaseKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) throw new ProviderAuthError("Provider session is invalid or expired.", 401);

  // app_metadata is server-controlled. Never authorize using user_metadata or a role header.
  if (data.user.app_metadata?.role !== "provider") {
    throw new ProviderAuthError("Provider access is required.", 403);
  }

  return { user: data.user, supabase: createServiceSupabaseClient() };
}

export function storagePathFromValue(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("http://") && !value.startsWith("https://")) return value;
  try {
    const marker = "/storage/v1/object/public/audio-recordings/";
    const pathname = new URL(value).pathname;
    const index = pathname.indexOf(marker);
    return index >= 0 ? decodeURIComponent(pathname.slice(index + marker.length)) : null;
  } catch {
    return null;
  }
}
