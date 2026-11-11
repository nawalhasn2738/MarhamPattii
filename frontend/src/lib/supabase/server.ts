import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicConfig } from './config';
// User scoped only. No service-role fallback.
export async function createServerSupabaseClient() {
  const store = await cookies();
  const { url, key } = publicConfig();
  return createServerClient(url, key, { cookies: {
    getAll: () => store.getAll(),
    setAll(values) {
      try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
      catch { /* Server components cannot write; proxy refreshes cookies. */ }
    },
  } });
}
