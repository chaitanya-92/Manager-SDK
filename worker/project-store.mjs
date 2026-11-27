import {manifest} from '../src/model.mjs';
export function cleanProject(c){
 if(!c||typeof c!=='object'||Array.isArray(c))throw new Error('Invalid configuration');
 if(c.logo!=null&&(typeof c.logo!=='string'||c.logo.length>700000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(c.logo)))throw new Error('Invalid logo');
 const m=manifest(c);
 return {framework:m.framework,name:m.name,package:m.package,commit:m.commit,logo:m.logo};
}
export function createProjectStore(url,key,request=fetch){
 const base=new URL(url);
 if(base.protocol!=='https:'||!base.hostname.endsWith('.supabase.co')||base.pathname!=='/'||base.username||base.password||base.port||base.search||base.hash)throw new Error('Set SUPABASE_URL to the dedicated hosted project URL');
 if(!key||typeof key!=='string')throw new Error('Set SUPABASE_SERVER_KEY');
 const headers={apikey:key,'Content-Type':'application/json',...(!key.startsWith('sb_secret_')?{Authorization:'Bearer '+key}:{})};
 async function call(query='',options={}){
  const r=await request(base.origin+'/rest/v1/manager_sdk_projects'+query,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error('Project storage unavailable ('+r.status+')');
  return r.json();
 }
 return {
  list:()=>call('?select=id,created_at,config&order=created_at.desc&limit=50'),
  async save(c){const config=cleanProject(c);const rows=await call('?select=id,created_at,config',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({config})});if(!rows[0]?.id)throw new Error('Project not saved');return rows[0];}
 };
}
