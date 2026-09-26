import { authenticated, edgeError, handleOptions, json } from "../_shared/http.ts";

type ProposedAction={title:string;rationale:string;category:"FINANCE"|"PROJET"|"COMMERCIAL"|"COMMUNICATION";priority:"NORMALE"|"HAUTE"|"URGENTE";action_type:"OPEN_PAGE"|"COMPLETE_TASK"|"MARK_INVOICE_SENT"|"SCHEDULE_FOLLOW_UP"|"PREPARE_MESSAGE";target_page:string;source_type:string;source_id:string|null;proposed_payload:Record<string,unknown>;risk_level:"FAIBLE"|"MODERE"|"ELEVE"};
const day=86_400_000;
const dateLabel=(value:string)=>new Date(value).toLocaleDateString("fr-FR",{timeZone:"Africa/Conakry"});
const textOutput=(body:{output_text?:string;output?:Array<{content?:Array<{type?:string;text?:string}>}>})=>body.output_text||body.output?.flatMap(item=>item.content||[]).find(item=>item.type==="output_text")?.text;

async function aiSummary(metrics:Record<string,number>,fallback:string){
  const key=Deno.env.get("OPENAI_API_KEY");if(!key)return fallback;
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${key}`},body:JSON.stringify({model:Deno.env.get("OPENAI_MODEL")||"gpt-5.6-luna",reasoning:{effort:"low"},max_output_tokens:180,instructions:"Tu es le directeur des opérations d'une agence à Conakry. Rédige une seule phrase de briefing en français, factuelle, calme, sans inventer de donnée et sans prétendre qu'une action a été exécutée.",input:JSON.stringify(metrics),text:{format:{type:"json_schema",name:"autopilot_briefing",strict:true,schema:{type:"object",additionalProperties:false,properties:{summary:{type:"string"}},required:["summary"]}}}})});
    if(!response.ok)return fallback;const raw=textOutput(await response.json());if(!raw)return fallback;return String(JSON.parse(raw).summary||fallback);
  }catch{return fallback}
}

Deno.serve(async(request)=>{
  const preflight=handleOptions(request);if(preflight)return preflight;
  if(request.method!=="POST")return json(request,{error:"Méthode non autorisée"},405);
  try{
    const{admin,user}=await authenticated(request),body=await request.json() as Record<string,unknown>,mode=String(body.mode||"");
    const[{data:profile,error:profileError},{data:access}]=await Promise.all([admin.from("profiles").select("full_name,role,roles").eq("id",user.id).single(),admin.from("user_access_controls").select("denied_permissions").eq("profile_id",user.id).maybeSingle()]);
    if(profileError)throw profileError;
    const roles=(profile.roles?.length?profile.roles:[profile.role]) as string[],privileged=roles.some(role=>["SUPER_ADMIN","ADMIN","MANAGER"].includes(role)),denied=(access?.denied_permissions||[]) as string[];
    if(roles.includes("CLIENT"))return json(request,{error:"Accès réservé à l'équipe SmartSell"},403);
    const permitted=(permission:string)=>privileged||!denied.includes(permission);

    if(mode==="run"){
      let{data:settings,error:settingsError}=await admin.from("autopilot_settings").select("*").eq("profile_id",user.id).maybeSingle();if(settingsError)throw settingsError;
      if(!settings){const created=await admin.from("autopilot_settings").insert({profile_id:user.id}).select().single();if(created.error)throw created.error;settings=created.data}
      if(!settings.enabled)return json(request,{error:"Autopilot est désactivé dans vos réglages"},409);
      const{data:run,error:runError}=await admin.from("autopilot_runs").insert({requested_by:user.id,status:"EN_COURS"}).select().single();if(runError)throw runError;
      try{
        const[invoicesQ,tasksQ,projectsQ,prospectsQ]=await Promise.all([
          admin.from("invoices").select("id,number,status,due_date,total,currency,client_id,clients(name,email,phone)"),
          admin.from("tasks").select("id,title,status,due_at,assignee_id,project_id,projects(name)"),
          admin.from("projects").select("id,name,status,progress,ends_on,manager_id,client_id,clients(name)"),
          admin.from("prospects").select("id,company,contact_name,stage,next_follow_up_at,owner_id,email,phone")
        ]);for(const query of[invoicesQ,tasksQ,projectsQ,prospectsQ])if(query.error)throw query.error;
        const now=new Date(),invoices=invoicesQ.data||[],tasks=tasksQ.data||[],projects=projectsQ.data||[],prospects=prospectsQ.data||[];
        const overdueInvoices=invoices.filter(row=>row.due_date&&new Date(row.due_date)<now&&!['PAYEE','ANNULEE'].includes(row.status));
        const lateTasks=tasks.filter(row=>row.due_at&&new Date(row.due_at)<now&&!['TERMINE','ANNULEE'].includes(row.status)&&(privileged||row.assignee_id===user.id));
        const stalledProjects=projects.filter(row=>row.ends_on&&new Date(row.ends_on)<now&&!['TERMINE','ANNULE'].includes(row.status)&&Number(row.progress||0)<100&&(privileged||row.manager_id===user.id));
        const followups=prospects.filter(row=>row.next_follow_up_at&&new Date(row.next_follow_up_at)<=now&&!['GAGNE','PERDU'].includes(row.stage)&&(privileged||row.owner_id===user.id));
        const actions:ProposedAction[]=[];
        if(permitted("invoices.send")&&roles.some(role=>["SUPER_ADMIN","ADMIN","MANAGER","COMPTABLE","COMMERCIAL"].includes(role)))for(const invoice of overdueInvoices)actions.push({title:`Relancer la facture ${invoice.number}`,rationale:`Échéance dépassée depuis le ${dateLabel(invoice.due_date)} pour ${Number(invoice.total||0).toLocaleString('fr-FR')} ${invoice.currency||'GNF'}.`,category:"FINANCE",priority:new Date(invoice.due_date).getTime()<now.getTime()-14*day?"URGENTE":"HAUTE",action_type:"PREPARE_MESSAGE",target_page:"Facturation",source_type:"invoice",source_id:invoice.id,proposed_payload:{message:`Bonjour ${invoice.clients?.name||''}, sauf erreur de notre part, la facture ${invoice.number} arrivée à échéance le ${dateLabel(invoice.due_date)} reste à régulariser. Merci de nous confirmer la date prévue de règlement.`,recipient:invoice.clients?.email||invoice.clients?.phone||""},risk_level:"FAIBLE"});
        if(permitted("tasks.update"))for(const task of lateTasks)actions.push({title:`Terminer « ${task.title} »`,rationale:`Cette tâche${task.projects?.name?` du projet ${task.projects.name}`:''} est échue depuis le ${dateLabel(task.due_at)}.`,category:"PROJET",priority:new Date(task.due_at).getTime()<now.getTime()-7*day?"URGENTE":"HAUTE",action_type:"COMPLETE_TASK",target_page:"Tâches",source_type:"task",source_id:task.id,proposed_payload:{status:"TERMINE"},risk_level:"MODERE"});
        if(permitted("projects.update"))for(const project of stalledProjects)actions.push({title:`Revoir le projet ${project.name}`,rationale:`Échéance dépassée le ${dateLabel(project.ends_on)} avec une progression de ${Number(project.progress||0)} %.`,category:"PROJET",priority:"HAUTE",action_type:"OPEN_PAGE",target_page:"Projets",source_type:"project",source_id:project.id,proposed_payload:{},risk_level:"FAIBLE"});
        if(permitted("clients.update"))for(const prospect of followups)actions.push({title:`Relancer ${prospect.company}`,rationale:`La relance commerciale prévue le ${dateLabel(prospect.next_follow_up_at)} n'est pas clôturée.`,category:"COMMERCIAL",priority:"HAUTE",action_type:"SCHEDULE_FOLLOW_UP",target_page:"Communication",source_type:"prospect",source_id:prospect.id,proposed_payload:{next_follow_up_at:new Date(now.getTime()+2*day).toISOString()},risk_level:"FAIBLE"});
        const limited=actions.sort((a,b)=>({URGENTE:3,HAUTE:2,NORMALE:1}[b.priority]-{URGENTE:3,HAUTE:2,NORMALE:1}[a.priority])).slice(0,Number(settings.max_actions_per_run||12));
        const metrics={overdue_invoices:overdueInvoices.length,late_tasks:lateTasks.length,stalled_projects:stalledProjects.length,followups_due:followups.length,total_actions:limited.length};
        const fallback=limited.length?`${limited.length} action(s) prioritaire(s) préparée(s) : ${lateTasks.length} tâche(s) en retard, ${overdueInvoices.length} facture(s) échue(s), ${stalledProjects.length} projet(s) à relancer et ${followups.length} suivi(s) commercial(aux).`:"Aucune urgence opérationnelle détectée : la situation est sous contrôle.";
        const summary=await aiSummary(metrics,fallback);
        let inserted:unknown[]=[];if(limited.length){const result=await admin.from("autopilot_actions").insert(limited.map(action=>({...action,run_id:run.id,owner_id:user.id,approval_required:true,status:"A_VALIDER"}))).select();if(result.error)throw result.error;inserted=result.data||[]}
        const completed=await admin.from("autopilot_runs").update({status:"TERMINE",summary,metrics,completed_at:new Date().toISOString()}).eq("id",run.id).select().single();if(completed.error)throw completed.error;
        await admin.from("activity_logs").insert({actor_id:user.id,action:"ANALYZE",entity_type:"autopilot_run",entity_id:run.id,metadata:metrics});
        return json(request,{run:{...completed.data,autopilot_actions:inserted}});
      }catch(error){await admin.from("autopilot_runs").update({status:"ECHEC",summary:"Analyse interrompue",completed_at:new Date().toISOString()}).eq("id",run.id);throw error}
    }

    const actionId=String(body.action_id||"");if(!actionId)return json(request,{error:"Action manquante"},400);
    const{data:action,error:actionError}=await admin.from("autopilot_actions").select("*").eq("id",actionId).single();if(actionError)throw actionError;
    if(action.owner_id!==user.id&&!privileged)return json(request,{error:"Action non autorisée"},403);

    if(mode==="decide"){
      if(action.status!=="A_VALIDER")return json(request,{error:"Cette action a déjà été traitée"},409);
      const decision=String(body.decision||"");if(!['APPROVE','REJECT'].includes(decision))return json(request,{error:"Décision invalide"},400);
      const status=decision==='APPROVE'?'APPROUVEE':'REJETEE',updated=await admin.from("autopilot_actions").update({status,approved_by:user.id,approved_at:new Date().toISOString()}).eq("id",actionId).eq("status","A_VALIDER").select().single();if(updated.error)throw updated.error;
      await admin.from("activity_logs").insert({actor_id:user.id,action:decision,entity_type:"autopilot_action",entity_id:actionId,metadata:{action_type:action.action_type,source_type:action.source_type,source_id:action.source_id}});
      return json(request,{action:updated.data});
    }

    if(mode==="execute"){
      if(action.status!=="APPROUVEE"||!action.approval_required||!action.approved_by)return json(request,{error:"Une approbation explicite est requise avant exécution"},409);
      const{data:executionSettings}=await admin.from("autopilot_settings").select("enabled,mode").eq("profile_id",action.owner_id).maybeSingle();
      if(!executionSettings?.enabled)return json(request,{error:"Autopilot est désactivé"},409);
      if(executionSettings.mode==="OBSERVATION")return json(request,{error:"Le mode Observation interdit toute exécution. Passez en Copilote pour agir."},409);
      const permissionByType:Record<string,string>={COMPLETE_TASK:"tasks.update",MARK_INVOICE_SENT:"invoices.update",SCHEDULE_FOLLOW_UP:"clients.update",PREPARE_MESSAGE:"invoices.send"},required=permissionByType[action.action_type];
      if(required&&!permitted(required))return json(request,{error:"Votre profil ne possède plus le droit requis pour cette action"},403);
      let result:Record<string,unknown>={detail:"Action ouverte dans SmartSell."};
      try{
        const claim=await admin.from("autopilot_actions").update({status:"EXECUTEE",executed_at:new Date().toISOString(),result:{detail:"Exécution en cours"}}).eq("id",actionId).eq("status","APPROUVEE").select("id").maybeSingle();if(claim.error)throw claim.error;if(!claim.data)return json(request,{error:"Cette action est déjà en cours ou exécutée"},409);
        if(action.action_type==="COMPLETE_TASK"){const update=await admin.from("tasks").update({status:"TERMINE",completed_at:new Date().toISOString()}).eq("id",action.source_id).select("id,status").single();if(update.error)throw update.error;result={detail:"Tâche marquée comme terminée.",record:update.data}}
        else if(action.action_type==="MARK_INVOICE_SENT"){const update=await admin.from("invoices").update({status:"ENVOYEE"}).eq("id",action.source_id).not("status","in",'(PAYEE,ANNULEE)').select("id,status").single();if(update.error)throw update.error;result={detail:"Facture marquée comme envoyée.",record:update.data}}
        else if(action.action_type==="SCHEDULE_FOLLOW_UP"){const at=String(action.proposed_payload?.next_follow_up_at||"");if(!at||Number.isNaN(new Date(at).getTime()))throw new Error("Date de relance invalide");const update=await admin.from("prospects").update({next_follow_up_at:at}).eq("id",action.source_id).select("id,next_follow_up_at").single();if(update.error)throw update.error;result={detail:`Nouvelle relance programmée le ${dateLabel(at)}.`,record:update.data}}
        else if(action.action_type==="PREPARE_MESSAGE")result={detail:"Brouillon préparé. Aucun message n'a été envoyé automatiquement.",message:String(action.proposed_payload?.message||""),recipient:String(action.proposed_payload?.recipient||"")};
        const completed=await admin.from("autopilot_actions").update({result}).eq("id",actionId).eq("status","EXECUTEE").select().single();if(completed.error)throw completed.error;
        await admin.from("activity_logs").insert({actor_id:user.id,action:"EXECUTE",entity_type:"autopilot_action",entity_id:actionId,metadata:{action_type:action.action_type,source_type:action.source_type,source_id:action.source_id,result}});
        return json(request,{action:completed.data});
      }catch(error){await admin.from("autopilot_actions").update({status:"ECHEC",executed_at:new Date().toISOString(),result:{error:error instanceof Error?error.message:"Échec"}}).eq("id",actionId);throw error}
    }
    return json(request,{error:"Mode inconnu"},400);
  }catch(error){return edgeError(request,error)}
});
