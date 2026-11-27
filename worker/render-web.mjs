import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {createReadStream,statSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createCircleClient} from './circleci.mjs';
import {createProjectStore,cleanProject} from './project-store.mjs';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const digest=v=>createHash('sha256').update(v).digest();
async function body(req){let n=0;const chunks=[];for await(const c of req){n+=c.length;if(n>750000)throw new Error('Request too large');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export function createRenderServer({dist=resolve('dist'),user='owner',password,origin,store,ci=null}){
 if(typeof password!=='string'||password.length<24)throw new Error('Set a random owner password (24+ characters)');
 if(!origin||new URL(origin).origin!==origin||!origin.startsWith('https://'))throw new Error('Set exact HTTPS workspace origin');
 const expected=digest('Basic '+Buffer.from(user+':'+password).toString('base64'));
 let lastTrigger=0;let submitting=false;
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 return createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  const p=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&p==='/healthz')return json(res,200,{ok:true});
  if(!timingSafeEqual(digest(req.headers.authorization||''),expected)){res.setHeader('WWW-Authenticate','Basic realm="Manager SDK"');return json(res,401,{error:'Authentication required'});}
  if(req.method==='POST'&&(req.headers.origin!==origin||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')))return json(res,403,{error:'Same-origin JSON required'});
  try{
   if(req.method==='GET'&&p==='/api/factory/status')return json(res,200,{ready:false,active:false,mode:'render',projectsAvailable:!!store,ciConfigured:!!ci,reason:'Android build worker not connected'});
   if(p==='/api/ci/pipelines'&&req.method==='GET'){
    if(!ci)return json(res,503,{error:'CircleCI not configured'});
    const pipelines=await ci.list();
    const results=await Promise.all(pipelines.map(async p=>({...p,workflows:await ci.workflows(p.id).catch(()=>null)})));
    return json(res,200,{pipelines:results});
   }
   if(p==='/api/ci/verify'&&req.method==='POST'){
    if(!ci)return json(res,503,{error:'CircleCI not configured'});
    if(submitting||Date.now()-lastTrigger<60000)return json(res,429,{error:'Wait at least one minute between verification requests'});
    submitting=true;lastTrigger=Date.now();
    try{const recent=await ci.list();if(recent.some(p=>['created','pending','setup-pending','setup','running'].includes(p.state)))return json(res,409,{error:'A recent pipeline is still pending; check CircleCI first'});
     return json(res,202,{pipeline:await ci.trigger(),kind:'workspace-verification'});
    }finally{submitting=false;}
   }
   if(p==='/api/projects'&&['GET','POST'].includes(req.method)){
    if(!store)return json(res,503,{error:'Database not configured'});
    if(req.method==='GET')return json(res,200,{projects:await store.list()});
    let c;try{c=cleanProject(await body(req));}catch(e){return json(res,400,{error:e.message});}
    return json(res,201,{project:await store.save(c)});
   }
   if(p.startsWith('/api/'))return json(res,503,{error:'Android build worker not connected. No APK job started.'});
   if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
   const file=p==='/'?'index.html':/^\/assets\/[a-zA-Z0-9._-]+$/.test(p)?p.slice(1):null;
   if(!file)return json(res,404,{error:'Not found'});
   const path=join(dist,file);let st;try{st=statSync(path);if(!st.isFile())throw new Error();}catch{return json(res,404,{error:'Not found'});}
   res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Length':st.size});
   if(req.method==='HEAD')return res.end();
   const stream=createReadStream(path);stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch(e){console.error('Workspace request failed:',e.message);if(!res.headersSent)return json(res,503,{error:'Workspace request failed; check deployment configuration'});res.destroy();}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVER_KEY;
 if(Boolean(url)!==Boolean(key))throw new Error('Configure both Supabase settings');
 const store=url?createProjectStore(url,key):null;
 createRenderServer({password:process.env.MANAGER_SDK_PASSWORD,user:process.env.MANAGER_SDK_USER,origin:process.env.MANAGER_SDK_ORIGIN||process.env.RENDER_EXTERNAL_URL,store,ci:createCircleClient()}).listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('Private workspace online'));
}
