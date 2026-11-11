import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/supabase/config.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { publicConfig } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const jwt = role => `e30.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
function config(t, url, key, anon) {
  const names = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const before = names.map(n => process.env[n]);
  t.after(() => names.forEach((n,i) => before[i] === undefined ? delete process.env[n] : process.env[n] = before[i]));
  names.forEach(n => delete process.env[n]);
  for (const [n,v] of [[names[0],url],[names[1],key],[names[2],anon]]) if (v !== undefined) process.env[n] = v;
}
test('missing public configuration fails without credentials in error', t => {
  config(t); assert.throws(publicConfig, /not configured/);
});
for (const url of ['not-a-url','http://project.supabase.co','https://user:pass@project.supabase.co','https://project.supabase.co/path']) {
  test(`invalid origin rejected: ${url}`, t => {
    config(t,url,'sb_publishable_test'); assert.throws(publicConfig);
  });
}
for (const key of ['sb_secret_test',jwt('service_role'),jwt('authenticated'),'malformed']) {
  test('privileged or invalid public credential rejected', t => {
    config(t,'https://project.supabase.co',key); assert.throws(publicConfig,/Secret keys are not permitted/);
  });
}
test('publishable key and local development origin accepted', t => {
  config(t,'http://127.0.0.1:54321','sb_publishable_test'); assert.equal(publicConfig().url,'http://127.0.0.1:54321');
});
test('empty publishable key falls back to legacy anon key', t => {
  config(t,'https://project.supabase.co','',jwt('anon')); assert.equal(publicConfig().key,jwt('anon'));
});
