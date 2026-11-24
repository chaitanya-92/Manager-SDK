import {randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {join} from 'node:path';
import {build,home,validateBuild,diagnose} from './factory.mjs';
const jobs=new Map();let active=false;
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>900000)throw new Error('Request too large');}return JSON.parse(raw);}
export function workerPlugin(){return {name:'local-manager-worker',configureServer(server){
 server.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/factory/'))return next();
  // This is a loopback-only developer server, not an internet-facing API.
  const remote=req.socket.remoteAddress;
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)||!/^((localhost|127\.0\.0\.1)(:\d+)?)$/.test(req.headers.host||''))return json(res,403,{error:'Local requests only'});
  if(req.method==='POST'&&(!req.headers.origin||req.headers.origin!=='http://'+req.headers.host||!String(req.headers['content-type']).startsWith('application/json')))return json(res,403,{error:'Same-origin JSON required'});
  try{
   if(url.pathname==='/api/factory/status'&&req.method==='GET')return json(res,200,{ready:process.platform==='linux'&&process.arch==='x64'&&!!(process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT)&&!!(process.env.ANDROID_NDK_HOME||process.env.ANDROID_NDK_ROOT),platform:process.platform,active});
   if(url.pathname==='/api/factory/build'&&req.method==='POST'){
    if(active)return json(res,409,{error:'A build is already running'});
    const c=await body(req),errors=validateBuild(c);if(errors.length)return json(res,400,{error:errors.join(' ')});
    if(active)return json(res,409,{error:'A build is already running'});
    active=true;const id=randomUUID(),job={id,status:'running',logs:[],report:null};jobs.set(id,job);
    const log=s=>{job.logs.push(String(s).slice(0,4000));if(job.logs.length>500)job.logs.shift();};
    build(c,id,log).then(report=>{job.report=report;job.status='complete';}).catch(e=>{log('! '+e.message);job.status='failed';job.suggestions=diagnose(job.logs.join('\n'));}).finally(()=>{active=false;});
    return json(res,202,{id});
   }
   const m=url.pathname.match(/^\/api\/factory\/jobs\/([a-f0-9-]{36})(\/apk)?$/);
   if(m&&req.method==='GET'){const job=jobs.get(m[1]);if(!job)return json(res,404,{error:'Unknown job in this session'});if(!m[2])return json(res,200,job);
    if(job.status!=='complete'||!job.report?.apkVerified)return json(res,409,{error:'APK not verified'});
    res.writeHead(200,{'Content-Type':'application/vnd.android.package-archive','Content-Disposition':'attachment; filename="Manager.apk"','Cache-Control':'no-store'});const stream=createReadStream(join(home,'jobs',job.id,'Manager.apk'));stream.on('error',()=>res.destroy());stream.pipe(res);return;
   }
   return json(res,404,{error:'Not found'});
  }catch(e){return json(res,400,{error:e.message});}
 });
}};}