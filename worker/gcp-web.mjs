import {createServer} from 'node:http';
import {createReadStream,statSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
export function createWorkspaceServer(dist=resolve('dist')){
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 return createServer((req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  const p=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&p==='/api/factory/status')return json(res,200,{ready:false,active:false,mode:'gcp-preview',reason:'Android build worker not connected'});
  if(req.method==='GET'&&p==='/healthz')return json(res,200,{ok:true});
  if(p.startsWith('/api/'))return json(res,503,{error:'Android build worker not connected. No APK job has been started.'});
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
  const file=p==='/'?'index.html':/^\/assets\/[a-zA-Z0-9._-]+$/.test(p)?p.slice(1):null;
  if(!file)return json(res,404,{error:'Not found'});
  const path=join(dist,file);let st;try{st=statSync(path);if(!st.isFile())throw new Error();}catch{return json(res,404,{error:'Not found'});}
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Length':st.size,'Cache-Control':p==='/'?'no-store':'public, max-age=86400'});
  if(req.method==='HEAD')return res.end();
  const stream=createReadStream(path);stream.on('error',()=>res.destroy());stream.pipe(res);
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(process.env.RENDER==='true'||process.env.RENDER_EXTERNAL_URL||process.env.MANAGER_SDK_HOST==='render')throw new Error('Use node worker/hosted-start.mjs on Render; preview disabled.');const port=Number(process.env.PORT||8080);createWorkspaceServer().listen(port,'0.0.0.0',()=>console.log('Workspace preview listening on '+port));}
