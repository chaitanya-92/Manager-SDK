const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern=/^(?:gh|github|circleci)\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export function createCircleClient(env=process.env,request=fetch){
 const {CIRCLECI_TOKEN:token,CIRCLECI_PROJECT_SLUG:slug,CIRCLECI_PIPELINE_DEFINITION_ID:definition}=env;
 if(!token&&!slug&&!definition)return null;
 if(!token||!slugPattern.test(slug||'')||!uuid.test(definition||''))return null;
 const project='/project/'+slug;
 async function call(path,options={}){
  const res=await request('https://circleci.com/api/v2'+path,{...options,headers:{'Circle-Token':token,'Accept':'application/json','Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw new Error('CircleCI API returned HTTP '+res.status);
  return res.json();
 }
 const summarize=p=>({id:p.id,number:p.number,state:p.state,createdAt:p.created_at,branch:p.vcs?.branch||null});
 return {
  async list(){const data=await call(project+'/pipeline?branch=main');return (data.items||[]).filter(p=>uuid.test(p.id||'')).slice(0,8).map(summarize);},
  async workflows(id){if(!uuid.test(id))throw new Error('Invalid pipeline ID');const data=await call('/pipeline/'+id+'/workflow');return (data.items||[]).map(w=>({name:w.name,status:w.status}));},
  async trigger(){const data=await call(project+'/pipeline/run',{method:'POST',body:JSON.stringify({definition_id:definition,config:{branch:'main'},checkout:{branch:'main'}})});if(!uuid.test(data.id||''))throw new Error('CircleCI did not create a pipeline');return summarize(data);}
 };
}