import {mkdirSync,readdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
const valid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export class JobStore {
 constructor(dir){this.dir=dir;this.jobs=new Map();mkdirSync(dir,{recursive:true,mode:0o700});for(const n of readdirSync(dir)){const id=n.slice(0,-5);if(!n.endsWith('.json')||!valid.test(id))continue;const j=JSON.parse(readFileSync(join(dir,n),'utf8'));if(j.id!==id)throw new Error('Invalid persisted job');if(j.status==='running'){j.status='interrupted';j.logs=[...(j.logs||[]),'Server restarted: build interrupted.'].slice(-500);this.save(j);}else this.jobs.set(id,j);}}
 save(j){if(!valid.test(j.id))throw new Error('Invalid job ID');const p=join(this.dir,j.id+'.json');writeFileSync(p+'.tmp',JSON.stringify(j),{mode:0o600});renameSync(p+'.tmp',p);this.jobs.set(j.id,j);}
 get(id){return this.jobs.get(id);}
 list(){return [...this.jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(({logs,report,...j})=>({...j,apkVerified:report?.apkVerified===true,rootVerified:false}));}
}