type Task = {id:string;title:string;project_id:string|null;status:string;priority:string;due_at:string|null;assignee_id?:string|null;task_assignees?:{profile_id:string}[];projects?:{name:string;client_id:string|null}|null};
type Project = {id:string;name:string;client_id:string|null;status:string;progress:number;ends_on:string|null;manager_id?:string|null;project_members?:{profile_id:string}[]};
const closed=(status:string)=>['TERMINE','TERMINEE','ANNULE','ANNULEE','ARCHIVE','ARCHIVEE'].includes(status);
export function operationalActions(owner:string,projects:Project[],tasks:Task[],now=new Date()){
 const horizon=now.getTime()+7*86400000,actions:Record<string,unknown>[]=[];
 for(const task of tasks.filter(t=>!closed(t.status))){
  const reasons:string[]=[],due=task.due_at?new Date(task.due_at).getTime():NaN;
  const late=due<now.getTime(),soon=due>=now.getTime()&&due<=horizon;
  if(late)reasons.push('Échéance dépassée');else if(soon)reasons.push('Échéance dans les 7 prochains jours');
  if(!task.assignee_id&&!task.task_assignees?.length)reasons.push('Aucun responsable attribué');
  if(!reasons.length)continue;
  actions.push({owner_id:owner,source_type:'TASK',source_id:task.id,client_id:task.projects?.client_id||null,project_id:task.project_id,title:`${late?'Traiter le retard':!task.assignee_id&&!task.task_assignees?.length?'Attribuer':'Préparer'} : ${task.title}`,reason:reasons.join(' · '),priority:late?(task.priority==='URGENTE'?'URGENTE':'HAUTE'):soon?'HAUTE':'NORMALE',action_type:'NAVIGATE',target_page:'Tâches',action_payload:{task_id:task.id,client_id:task.projects?.client_id||null},_due:Number.isFinite(due)?due:Infinity});
 }
 for(const project of projects.filter(p=>!closed(p.status))){
  const reasons:string[]=[],due=project.ends_on?new Date(project.ends_on+'T23:59:59Z').getTime():NaN;
  const late=due<now.getTime()&&Number(project.progress)<100,soon=due>=now.getTime()&&due<=horizon&&Number(project.progress)<100;
  if(late)reasons.push(`Échéance dépassée avec ${Number(project.progress)||0} % d’avancement`);else if(soon)reasons.push('Fin prévue dans les 7 prochains jours');
  if(!tasks.some(t=>t.project_id===project.id))reasons.push('Aucune tâche définie');
  if(!project.manager_id&&!project.project_members?.length)reasons.push('Aucun responsable attribué');
  if(!reasons.length)continue;
  actions.push({owner_id:owner,source_type:'PROJECT',source_id:project.id,client_id:project.client_id,project_id:project.id,title:`${late?'Replanifier':!tasks.some(t=>t.project_id===project.id)?'Organiser':'Faire le point sur'} ${project.name}`,reason:reasons.join(' · '),priority:late||soon?'HAUTE':'NORMALE',action_type:'NAVIGATE',target_page:'Projets',action_payload:{client_id:project.client_id,project_id:project.id},_due:Number.isFinite(due)?due:Infinity});
 }
 const rank:Record<string,number>={URGENTE:0,HAUTE:1,NORMALE:2};
 return actions.sort((a,b)=>rank[String(a.priority)]-rank[String(b.priority)]||Number(a._due)-Number(b._due)).map(({_due,...action})=>action);
}
