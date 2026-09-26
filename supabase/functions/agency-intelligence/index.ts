import { authenticated, edgeError, handleOptions, json } from "../_shared/http.ts";

type Invoice = { id:string; number:string; client_id:string; total:number; status:string; due_date:string|null; clients?:{name:string}|null };
type Task = { id:string; title:string; project_id:string|null; status:string; priority:string; due_at:string|null; projects?:{name:string;client_id:string|null}|null };
type Project = { id:string; name:string; client_id:string|null; status:string; progress:number; ends_on:string|null; clients?:{name:string}|null };

const number = (value: unknown) => Number(value || 0);
const firstName = (value: string) => value.trim().split(/\s+/)[0] || "Manager";

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const { admin, user } = await authenticated(request);
    const { data: profile, error: profileError } = await admin.from("profiles").select("full_name,role,roles").eq("id", user.id).single();
    if (profileError) throw profileError;
    const roles = (profile.roles?.length ? profile.roles : [profile.role]) as string[];
    if (!roles.some((role) => ["SUPER_ADMIN","ADMIN","MANAGER"].includes(role))) return json(request, { error: "Le cockpit stratégique est réservé à la direction." }, 403);

    const [clientsQ, projectsQ, invoicesQ, tasksQ, paymentsQ, expensesQ, prospectsQ] = await Promise.all([
      admin.from("clients").select("id,name,status"),
      admin.from("projects").select("id,name,client_id,status,progress,ends_on,clients(name)"),
      admin.from("invoices").select("id,number,client_id,total,status,due_date,clients(name)"),
      admin.from("tasks").select("id,title,project_id,status,priority,due_at,projects(name,client_id)"),
      admin.from("payments").select("amount,paid_at"),
      admin.from("expenses").select("amount,status,spent_on"),
      admin.from("prospects").select("id,company,stage,next_follow_up_at")
    ]);
    for (const query of [clientsQ,projectsQ,invoicesQ,tasksQ,paymentsQ,expensesQ,prospectsQ]) if (query.error) throw query.error;

    const clients = clientsQ.data || [], projects = (projectsQ.data || []) as unknown as Project[], invoices = (invoicesQ.data || []) as unknown as Invoice[], tasks = (tasksQ.data || []) as unknown as Task[];
    const payments = paymentsQ.data || [], expenses = expensesQ.data || [], prospects = prospectsQ.data || [];
    const now = new Date(), today = now.toISOString().slice(0,10);
    const billed = invoices.reduce((sum,row)=>sum+number(row.total),0), collected = payments.reduce((sum,row)=>sum+number(row.amount),0), spent = expenses.filter(row=>row.status!=="REJETE").reduce((sum,row)=>sum+number(row.amount),0);
    const overdueInvoices = invoices.filter(row=>row.status!=="PAYEE"&&row.status!=="ANNULEE"&&row.due_date&&new Date(row.due_date)<now).sort((a,b)=>number(b.total)-number(a.total));
    const overdueTasks = tasks.filter(row=>row.status!=="TERMINE"&&row.due_at&&new Date(row.due_at)<now).sort((a,b)=>new Date(a.due_at||0).getTime()-new Date(b.due_at||0).getTime());
    const riskyProjects = projects.filter(row=>!["TERMINE","ANNULE"].includes(row.status)&&row.ends_on&&new Date(row.ends_on)<now&&number(row.progress)<100).sort((a,b)=>number(a.progress)-number(b.progress));
    const dueFollowUps = prospects.filter(row=>row.next_follow_up_at&&new Date(row.next_follow_up_at)<=now&&!["GAGNE","PERDU"].includes(row.stage));
    const metrics = { clients:clients.length, active_projects:projects.filter(row=>!["TERMINE","ANNULE"].includes(row.status)).length, open_tasks:tasks.filter(row=>row.status!=="TERMINE").length, overdue_tasks:overdueTasks.length, overdue_invoices:overdueInvoices.length, billed, collected, receivables:Math.max(0,billed-collected), spent, net_cash:collected-spent, prospects_to_follow:dueFollowUps.length };

    const deterministic = {
      greeting:`Bonjour ${firstName(profile.full_name)}, voici votre point de pilotage.`,
      summary:`${metrics.active_projects} projet(s) actif(s), ${metrics.open_tasks} tâche(s) ouverte(s) et ${metrics.overdue_invoices} facture(s) en retard nécessitent votre attention.`,
      opportunities: dueFollowUps.length ? [`${dueFollowUps.length} prospect(s) peuvent être relancés aujourd’hui.`] : ["Le pipeline ne présente aucune relance échue."],
      watchouts: [...(overdueInvoices.length?[`${overdueInvoices.length} facture(s) dépassent leur échéance.`]:[]),...(overdueTasks.length?[`${overdueTasks.length} tâche(s) sont en retard.`]:[])].slice(0,4)
    };
    let narrative = deterministic;
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (apiKey) {
      try {
        const aiResponse = await fetch("https://api.openai.com/v1/responses", { method:"POST", headers:{"content-type":"application/json",authorization:`Bearer ${apiKey}`}, body:JSON.stringify({
          model:Deno.env.get("OPENAI_MODEL")||"gpt-5.6-luna", reasoning:{effort:"low"}, max_output_tokens:700,
          instructions:"Tu es le directeur opérationnel IA de SmartSell, une agence à Conakry. Produis un briefing factuel, bref, professionnel et en français. Ne crée aucun chiffre absent. Ne prétends exécuter aucune action.",
          input:`Nom: ${profile.full_name}\nDate: ${today}\nIndicateurs JSON: ${JSON.stringify(metrics)}\nFactures en retard: ${overdueInvoices.slice(0,5).map(row=>`${row.number}:${row.total}`).join(", ")||"aucune"}\nTâches en retard: ${overdueTasks.slice(0,5).map(row=>row.title).join(", ")||"aucune"}`,
          text:{format:{type:"json_schema",name:"agency_briefing",strict:true,schema:{type:"object",additionalProperties:false,properties:{greeting:{type:"string"},summary:{type:"string"},opportunities:{type:"array",items:{type:"string"}},watchouts:{type:"array",items:{type:"string"}}},required:["greeting","summary","opportunities","watchouts"]}}}
        }) });
        if (aiResponse.ok) {
          const body = await aiResponse.json() as { output_text?:string; output?:Array<{content?:Array<{type?:string;text?:string}>}> };
          const text = body.output_text || body.output?.flatMap(item=>item.content||[]).find(item=>item.type==="output_text")?.text;
          if (text) try { narrative = JSON.parse(text); } catch { /* le briefing déterministe reste disponible */ }
        }
      } catch (error) {
        console.warn("OpenAI indisponible, briefing déterministe utilisé", error);
      }
    }

    const { data: briefing, error: briefingError } = await admin.from("agency_briefings").upsert({owner_id:user.id,briefing_date:today,...narrative,metrics,generated_at:new Date().toISOString()},{onConflict:"owner_id,briefing_date"}).select().single();
    if (briefingError) throw briefingError;
    await admin.from("next_best_actions").delete().eq("owner_id",user.id).eq("status","A_FAIRE");
    const actions:Record<string,unknown>[] = [];
    for (const invoice of overdueInvoices.slice(0,3)) actions.push({owner_id:user.id,source_type:"INVOICE",source_id:invoice.id,client_id:invoice.client_id,title:`Relancer ${invoice.clients?.name||"le client"}`,reason:`La facture ${invoice.number} de ${number(invoice.total).toLocaleString("fr-FR")} GNF est échue.`,priority:"URGENTE",action_type:"NAVIGATE",target_page:"Facturation",action_payload:{client_id:invoice.client_id,invoice_id:invoice.id}});
    for (const task of overdueTasks.slice(0,2)) actions.push({owner_id:user.id,source_type:"TASK",source_id:task.id,client_id:task.projects?.client_id||null,project_id:task.project_id,title:`Finaliser : ${task.title}`,reason:`Échéance dépassée${task.projects?.name?` sur ${task.projects.name}`:""}.`,priority:task.priority==="URGENTE"?"URGENTE":"HAUTE",action_type:"COMPLETE_TASK",target_page:"Tâches",action_payload:{task_id:task.id,client_id:task.projects?.client_id||null}});
    for (const project of riskyProjects.slice(0,2)) actions.push({owner_id:user.id,source_type:"PROJECT",source_id:project.id,client_id:project.client_id,project_id:project.id,title:`Replanifier ${project.name}`,reason:`Échéance dépassée avec ${number(project.progress)}% d’avancement.`,priority:"HAUTE",action_type:"NAVIGATE",target_page:"Projets",action_payload:{client_id:project.client_id,project_id:project.id}});
    if (!actions.length) actions.push({owner_id:user.id,source_type:"AGENCY",title:"Préparer la revue hebdomadaire",reason:"Les urgences principales sont maîtrisées. Consolidez les priorités de la semaine avec l’équipe.",priority:"NORMALE",action_type:"NAVIGATE",target_page:"Planning",action_payload:{}});
    const { data: savedActions, error: actionsError } = await admin.from("next_best_actions").insert(actions.slice(0,6)).select();
    if (actionsError) throw actionsError;
    await admin.from("activity_logs").insert({actor_id:user.id,action:"GENERATE",entity_type:"agency_briefing",entity_id:briefing.id,metadata:{actions:savedActions?.length||0}});
    return json(request,{briefing,actions:savedActions||[]});
  } catch (error) { return edgeError(request,error); }
});
