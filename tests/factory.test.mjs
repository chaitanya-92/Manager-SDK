import test from 'node:test';import assert from 'node:assert/strict';import {validateBuild,signingId,diagnose} from '../worker/factory.mjs';
const c={framework:'kernelsu',name:'Nova',package:'com.nova.manager',commit:'a'.repeat(40)};
test('build validation',()=>{assert.deepEqual(validateBuild(c),[]);assert.ok(validateBuild({...c,framework:'next'}).length);assert.ok(validateBuild({...c,name:'$(bad)'}).length);});
test('signer identity stable across releases',()=>{assert.equal(signingId(c),signingId({...c,commit:'b'.repeat(40)}));assert.notEqual(signingId(c),signingId({...c,package:'com.other.manager'}));});
test('failure diagnosis does not run commands',()=>assert.match(diagnose('SDK location not found')[0],/ANDROID_HOME/));