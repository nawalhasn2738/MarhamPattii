import { NextResponse } from 'next/server';
import { ApiError, assertSameOrigin, failure, requireUser } from '@/lib/server/api';
const statuses = new Set(['accepted', 'on_the_way', 'resolved', 'cancelled']);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireUser();
    assertSameOrigin(request);
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new ApiError(400, 'A valid request UUID is required.');
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'JSON is required.');
    const raw = await request.text();
    if (raw.length > 256) throw new ApiError(413, 'Request is too large.');
    let body;
    try { body = JSON.parse(raw); } catch { throw new ApiError(400, 'Valid JSON is required.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => k !== 'status') || !statuses.has(body.status)) throw new ApiError(400, 'Invalid status.');
    const { data, error } = await supabase.rpc('transition_community_request', { request_id: id, next_status: body.status });
    if (error) {
      if (error.code === 'P0002') throw new ApiError(404, 'Request not found.');
      if (error.code === '42501') throw new ApiError(403, 'You cannot perform this action.');
      if (error.code === '23514') throw new ApiError(409, 'This status transition is not permitted.');
      throw error;
    }
    return NextResponse.json({ success: true, request: data });
  } catch (error) { return failure(error); }
}
