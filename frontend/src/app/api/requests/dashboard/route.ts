import { NextResponse } from 'next/server';
import { failure, requireUser } from '@/lib/server/api';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from('community_requests').select('id,incident_type,note,status,created_at,updated_at').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return NextResponse.json({ success: true, requests: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}
