import 'server-only';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function requireUser() {
  const store = await cookies();
  if (!store.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('auth-token'))) throw new ApiError(401, 'Sign in to continue.');
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new ApiError(401, 'Your session is invalid or expired.');
  return { supabase, user };
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, 'Cross-origin writes are not permitted.');
}
export function failure(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('Request service unavailable');
  return NextResponse.json({ success: false, error: 'Request service unavailable. The database foundation may need configuration.' }, { status: 503 });
}
