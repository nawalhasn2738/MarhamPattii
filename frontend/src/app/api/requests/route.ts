import { NextResponse } from 'next/server';
import { ApiError, assertSameOrigin, failure, requireUser } from '@/lib/server/api';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    assertSameOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'Use JSON with incident_type and note. Legacy audio uploads are disabled.');
    const raw = await request.text();
    if (raw.length > 8000) throw new ApiError(413, 'Request is too large.');
    let body;
    try { body = JSON.parse(raw); } catch { throw new ApiError(400, 'Valid JSON is required.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['incident_type', 'note'].includes(k))) throw new ApiError(400, 'Only incident_type and note are accepted.');
    const { incident_type, note } = body;
    if (typeof incident_type !== 'string' || !incident_type.trim() || incident_type.length > 80 || typeof note !== 'string' || !note.trim() || note.length > 2000) throw new ApiError(400, 'Provide incident_type (1–80 characters) and note (1–2000 characters).');
    const { data, error } = await supabase.from('community_requests').insert({ owner_id: user.id, incident_type: incident_type.trim(), note: note.trim() }).select('id,incident_type,note,status,created_at,updated_at').single();
    if (error) throw error;
    return NextResponse.json({ success: true, request: data }, { status: 201 });
  } catch (error) { return failure(error); }
}
