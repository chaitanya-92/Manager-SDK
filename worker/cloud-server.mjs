import {createServer} from 'node:http';
import {randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,createReadStream,statSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {build,home,validateBuild,diagnose} from './factory.mjs';
import {JobStore} from './job-store.mjs';
const origin=process.env.MANAGER_SDK_ORIGIN;
if(!origin||new URL(origin).origin!==origin||!origin.startsWith('https://'))throw new Error('Configure exact HTTPS origin');
const password=readFileSync(process.env.MANAGER_SDK_PASSWORD_FILE,'utf8').trim();
if(password.length<24)throw new Error('Use a random password of at least 24 characters');
const hash=s=>createHash('sha256').update(s).digest();
const expected=hash('Basic '+Buffer.from((process.env.MANAGER_SDK_USER||'owner')+':'+password).toString('base64'));
const store=new JobStore(join(home,'job-state')),dist=resolve('dist');
const allowed=new Set((process.env.MANAGER_SDK_REVIEWED_COMMITS||'').split(',').map(s=>s.trim().toLowerCase()).filter(s=>/^(kernelsu|next):[a-f0-9]{40}$/.test(s)));
const ready=()=>process.platform==='linux'&&process.arch==='x64'&&!!(process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT)&&!!(process.env.ANDROID_NDK_HOME||process.env.ANDROID_NDK_ROOT)&&allowed.size>0;
let active=false;
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>900000)throw new Error('Request too large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
function send(res,path,type,download=false){let st;try{st=statSync(path);if(!st.isFile())throw new Error();}catch{return json(res,404,{error:'File unavailable'});}res.writeHead(200,{'Content-Type':type,'Content-Length':st.size,'Cache-Control':'no-store',...(download?{'Content-Disposition':'attachment; filename="Manager.apk"'}:{})});const stream=createReadStream(path);stream.on('error',()=>res.destroy());stream.pipe(res);}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
 if(!timingSafeEqual(hash(req.headers.authorization||''),expected)){res.setHeader('WWW-Authenticate','Basic realm="Manager SDK"');return json(res,401,{error:'Authentication required'});}
 const p=new URL(req.url,'http://localhost').pathname;
 if(req.method==='POST'&&(req.headers.origin!==origin||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')))return json(res,403,{error:'Same-origin JSON required'});
 try{
 if(p==='/api/factory/status'&&req.method==='GET')return json(res,200,{ready:ready(),active,mode:'cloud'});
 if(p==='/api/factory/jobs'&&req.method==='GET')return json(res,200,{jobs:store.list()});
 if(p==='/api/factory/build'&&req.method==='POST'){
 if(!ready())return json(res,503,{error:'Worker configuration unavailable'});
 if(active)return json(res,409,{error:'Build running'});
 const c=await body(req);if(!c||typeof c!=='object')return json(res,400,{error:'Invalid configuration'});
 const errors=validateBuild(c);if(errors.length)return json(res,400,{error:errors.join(' ')});
 if(!allowed.has(c.framework+':'+c.commit.toLowerCase()))return json(res,400,{error:'Source revision not reviewed by owner'});
 if(active)return json(res,409,{error:'Build running'});
 const id=randomUUID(),job={id,status:'running',name:c.name,framework:c.framework,createdAt:new Date().toISOString(),logs:[],report:null};
 store.save(job);active=true;
 const log=s=>{job.logs.push(String(s).slice(0,4000));job.logs=job.logs.slice(-500);try{store.save(job);}catch(e){console.error('Job persistence failed:',e.message);}};
 Promise.resolve().then(()=>build({...c,fork:false},id,log)).then(report=>{job.report=report;job.status='complete';store.save(job);}).catch(e=>{job.status='failed';job.suggestions=diagnose(job.logs.join('\n'));log('! '+e.message);}).finally(()=>{active=false;});
 return json(res,202,{id});
 }
 const m=p.match(/^\/api\/factory\/jobs\/([0-9a-f-]{36})(\/apk)?$/);
 if(m&&req.method==='GET'){const job=store.get(m[1]);if(!job)return json(res,404,{error:'Unknown job'});if(!m[2])return json(res,200,job);if(job.status!=='complete'||!job.report?.apkVerified)return json(res,409,{error:'APK not verified'});return send(res,join(home,'jobs',job.id,'Manager.apk'),'application/vnd.android.package-archive',true);}
 if(p.startsWith('/api/')||req.method!=='GET')return json(res,404,{error:'Not found'});
 if(p==='/')return send(res,join(dist,'index.html'),mime['.html']);
 if(/^\/assets\/[a-zA-Z0-9._-]+$/.test(p))return send(res,join(dist,p.slice(1)),mime[extname(p)]||'application/octet-stream');
 return json(res,404,{error:'Not found'});
 }catch(e){console.error('Request failed:',e.message);if(!res.headersSent)return json(res,400,{error:'Request failed; check logs'});res.destroy();}
});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(Number(process.env.PORT||8787),'127.0.0.1',()=>console.log('Private cloud workspace listening on loopback'));
