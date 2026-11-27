import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createWorkspaceServer} from './gcp-web.mjs';
import {createRenderServer} from './render-web.mjs';
import {createCircleClient} from './circleci.mjs';
import {createProjectStore} from './project-store.mjs';

export function hostedMode(env=process.env){
 if(env.RENDER==='true'||env.RENDER_EXTERNAL_URL||env.MANAGER_SDK_HOST==='render')return 'render';
 if(env.MANAGER_SDK_HOST&&env.MANAGER_SDK_HOST!=='gcp-preview')throw new Error('Unknown hosted runtime');
 return 'gcp-preview';
}
export function createHostedServer(env=process.env){
 if(hostedMode(env)==='render'){
  const url=env.SUPABASE_URL,key=env.SUPABASE_SERVER_KEY;
  if(!url||!key)throw new Error('Render requires SUPABASE_URL and SUPABASE_SERVER_KEY. Refusing to start the public preview.');
  const store=createProjectStore(url,key);
  return createRenderServer({password:env.MANAGER_SDK_PASSWORD,user:env.MANAGER_SDK_USER||'owner',origin:env.MANAGER_SDK_ORIGIN||env.RENDER_EXTERNAL_URL,store,ci:createCircleClient(env)});
 }
 return createWorkspaceServer();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const mode=hostedMode();
 createHostedServer().listen(Number(process.env.PORT||(mode==='render'?10000:8080)),'0.0.0.0',()=>console.log('Manager SDK runtime: '+mode));
}
