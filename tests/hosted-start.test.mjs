import test from 'node:test';
import assert from 'node:assert/strict';
import {hostedMode,createHostedServer} from '../worker/hosted-start.mjs';
test('Render cannot silently select the Google Cloud preview',()=>{
 assert.equal(hostedMode({RENDER:'true'}),'render');
 assert.equal(hostedMode({RENDER_EXTERNAL_URL:'https://manager-sdk.onrender.com'}),'render');
 assert.equal(hostedMode({RENDER:'true',MANAGER_SDK_HOST:'gcp-preview'}),'render');
 assert.equal(hostedMode({}),'gcp-preview');
 assert.throws(()=>createHostedServer({RENDER:'true'}),/requires SUPABASE_URL/);
 assert.throws(()=>createHostedServer({RENDER:'true',RENDER_EXTERNAL_URL:'https://manager-sdk.onrender.com',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVER_KEY:'sb_secret_test'}),/owner password/);
});
