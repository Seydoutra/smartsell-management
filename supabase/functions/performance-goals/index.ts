import { authenticated, handleOptions, json } from '../_shared/http.ts';
Deno.serve(async request=>{
 const options=handleOptions(request);if(options)return options;
 if(request.method!=='POST')return json(request,{error:'Méthode non autorisée'},405);
 try{
  const {admin,user}=await authenticated(request);
  const body=await request.json();
  const {data,error}=await admin.rpc('performance_goal_command',{p_actor:user.id,p_body:body});
  if(error)return json(request,{error:error.message},400);
  return json(request,data);
 }catch(error){if(error instanceof Response)return error;return json(request,{error:'Service des objectifs indisponible'},500);}
});
