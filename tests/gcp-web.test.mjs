import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createWorkspaceServer} from '../worker/gcp-web.mjs';
test('Cloud Run preview serves workspace but does not pretend to build',async()=>{const dir=mkdtempSync(join(tmpdir(),'sdk-web-'));writeFileSync(join(dir,'index.html'),'workspace');const server=createWorkspaceServer(dir);server.listen(0,'127.0.0.1');await once(server,'listening');try{const base='http://127.0.0.1:'+server.address().port;assert.equal(await (await fetch(base)).text(),'workspace');const state=await (await fetch(base+'/api/factory/status')).json();assert.equal(state.ready,false);assert.equal(state.mode,'gcp-preview');assert.equal((await fetch(base+'/api/factory/build',{method:'POST'})).status,503);assert.equal((await fetch(base+'/worker/factory.mjs')).status,404);}finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}});
