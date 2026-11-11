import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SignOut } from '@/components/SignOut';
export const dynamic = 'force-dynamic';
export default async function Dashboard() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <section className="dashboard"><p className="eyebrow">YOUR COMMUNITY SPACE</p><h1>Welcome to<br/><em>MarhamPattii.</em></h1><p className="intro">Signed in as {user.email}</p><div className="notice"><strong>Your account foundation is ready.</strong><p>First-aid guidance, responder requests, hospital discovery, and community safety are not available yet. This dashboard does not send emergency assistance.</p></div><div className="account-row"><div><h2>Private by default</h2><p>Request access is tied to your verified account. Trusted roles cannot be self-assigned.</p></div><SignOut/></div></section>;
}
