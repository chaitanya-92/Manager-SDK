import test from 'node:test';import assert from 'node:assert/strict';import {validate,manifest,terminalCommand} from '../src/model.mjs';
const c={framework:'kernelsu',name:'Nova',package:'com.nova.manager',commit:'a'.repeat(40)};
test('valid manifest never claims root',()=>{assert.deepEqual(validate(c),[]);assert.equal(manifest(c).verified.root,false);assert.equal(manifest(c).delivery,'manager-apk');});
test('invalid source and package fail closed',()=>{assert.throws(()=>manifest({...c,framework:'other',package:'bad'}));assert.throws(()=>manifest({...c,commit:'main'}));});
test('terminal does not execute arbitrary commands',()=>assert.match(terminalCommand('rm -rf /',c)[0],/Unknown/));