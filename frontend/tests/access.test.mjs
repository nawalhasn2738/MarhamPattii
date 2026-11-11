import test from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.API_BASE_URL || 'http://localhost:3000';
for (const [method, path] of [['GET','/api/requests/dashboard'],['POST','/api/requests'],['PATCH','/api/requests/00000000-0000-4000-8000-000000000001']]) {
  test(`${method} ${path} denies anonymous callers`, async () => {
    const response = await fetch(base + path, { method });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).success, false);
  });
}
test('dashboard redirects anonymous users to login', async () => {
  const response = await fetch(base + '/dashboard', { redirect: 'manual' });
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location'), base).pathname, '/login');
});
test('invalid session cookie cannot authorize private data', async () => {
  const response = await fetch(base + '/api/requests/dashboard', { headers: { Cookie: 'sb-forged-auth-token=not-a-valid-session' } });
  assert.equal(response.status, 401);
});
test('confirmation callback without code fails safely', async () => {
  const response = await fetch(base + '/auth/callback', { redirect: 'manual' });
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location'), base).pathname, '/auth/error');
});
test('caller identity and role headers do not authorize access', async () => {
  const response = await fetch(base + '/api/requests/dashboard', {
    headers: { 'X-User-Id': '10000000-0000-4000-8000-000000000001', 'X-Role': 'admin' },
  });
  assert.equal(response.status, 401);
});
test('anonymous JSON writes remain unauthorized with forged identity', async () => {
  const response = await fetch(base + '/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ incident_type: 'other', note: 'Synthetic', owner_id: '10000000-0000-4000-8000-000000000001', role: 'admin' }) });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { success: false, error: 'Sign in to continue.' });
});
