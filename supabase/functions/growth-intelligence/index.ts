import { authenticated, edgeError, handleOptions, json } from "../_shared/http.ts";

const n = (value: unknown) => Number(value || 0);
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(value)));
const textOutput = (body: { output_text?:string; output?:Array<{content?:Array<{type?:string;text?:string}>}> }) => body.output_text || body.output?.flatMap(item=>item.content||[]).find(item=>item.type==="output_text")?.text;

async function structuredAi(instructions:string,input:string,name:string,schema:Record<string,unknown>) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${apiKey}`},body:JSON.stringify({
    model:Deno.env.get("OPENAI_MODEL")||"gpt-5.6-luna",reasoning:{effort:"low"},max_output_tokens:1400,instructions,input,
    text:{format:{type:"json_schema",name,strict:true,schema}}
  })});
  if (!response.ok) return null;
  const value = textOutput(await response.json());
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

Deno.serve(async (request) => {
  const preflight=handleOptions(request); if(preflight)return preflight;
  if(request.method!=="POST")return json(request,{error:"Méthode non autorisée"},405);
  try {
    const {admin,user}=await authenticated(request);
    const body=await request.json() as Record<string,unknown>;
    const mode=String(body.mode||"");
    const {data:profile,error:profileError}=await admin.from("profiles").select("full_name,role,roles").eq("id",user.id).single();
    if(profileError)throw profileError;
    const roles=(profile.roles?.length?profile.roles:[profile.role]) as string[];
    if(roles.includes("CLIENT"))return json(request,{error:"Accès réservé à l'équipe SmartSell"},403);

    const [clientsQ,projectsQ,invoicesQ,paymentsQ,expensesQ,tasksQ,prospectsQ,activitiesQ]=await Promise.all([
      admin.from("clients").select("id,name,status,created_at"),
      admin.from("projects").select("id,name,client_id,status,progress,budget,starts_on,ends_on,created_at"),
      admin.from("invoices").select("id,client_id,total,status,issue_date,due_date,created_at"),
      admin.from("payments").select("invoice_id,amount,paid_at"),
      admin.from("expenses").select("amount,status,spent_on,project_id"),
      admin.from("tasks").select("id,project_id,status,due_at,created_at"),
      admin.from("prospects").select("id,company,contact_name,email,phone,stage,last_contact_at,next_follow_up_at,sms_opt_in,email_opt_in,marketing_opt_in,created_at"),
      admin.from("activity_logs").select("entity_type,entity_id,created_at").order("created_at",{ascending:false}).limit(1000)
    ]);
    for(const q of [clientsQ,projectsQ,invoicesQ,paymentsQ,expensesQ,tasksQ,prospectsQ,activitiesQ])if(q.error)throw q.error;
    const clients=clientsQ.data||[],projects=projectsQ.data||[],invoices=invoicesQ.data||[],payments=paymentsQ.data||[],expenses=expensesQ.data||[],tasks=tasksQ.data||[],prospects=prospectsQ.data||[],activities=activitiesQ.data||[];
    const now=new Date(), day=86_400_000;

    if(mode==="digital_twin"){
      if(!roles.some(role=>["SUPER_ADMIN","ADMIN","MANAGER","COMPTABLE"].includes(role)))return json(request,{error:"Accès finance requis"},403);
      const billed=invoices.reduce((sum,row)=>sum+n(row.total),0),collected=payments.reduce((sum,row)=>sum+n(row.amount),0),spent=expenses.filter(row=>row.status!=="REJETE").reduce((sum,row)=>sum+n(row.amount),0);
      const recentPayments=payments.filter(row=>new Date(row.paid_at).getTime()>=now.getTime()-90*day).reduce((sum,row)=>sum+n(row.amount),0);
      const recentExpenses=expenses.filter(row=>row.status!=="REJETE"&&new Date(row.spent_on).getTime()>=now.getTime()-90*day).reduce((sum,row)=>sum+n(row.amount),0);
      const baseMonthlyRevenue=recentPayments/3,baseMonthlyExpenses=recentExpenses/3;
      const delay=Math.max(0,n(body.client_delay_days)),contract=Math.max(0,n(body.new_contract_value)),expenseDelta=n(body.expense_change_percent);
      const delayedCash=delay?Math.max(0,1-Math.min(delay,90)/120):1;
      const forecast30=baseMonthlyRevenue*delayedCash+contract-baseMonthlyExpenses*(1+expenseDelta/100);
      const projections=Array.from({length:6},(_,index)=>{const growth=1+index*.025,revenue=baseMonthlyRevenue*growth*delayedCash+(index===0?contract:0),cost=baseMonthlyExpenses*(1+expenseDelta/100)*(1+index*.012);return{label:new Intl.DateTimeFormat("fr-FR",{month:"short"}).format(new Date(now.getFullYear(),now.getMonth()+index+1,1)),revenue:Math.round(revenue),expenses:Math.round(cost),cash:Math.round(collected-spent+forecast30*(index+1))}});
      const overdue=invoices.filter(row=>!["PAYEE","ANNULEE"].includes(row.status)&&row.due_date&&new Date(row.due_date)<now);
      const lateProjects=projects.filter(row=>!["TERMINE","ANNULE"].includes(row.status)&&row.ends_on&&new Date(row.ends_on)<now&&n(row.progress)<100);
      const risks=[...(overdue.length?[`${overdue.length} facture(s) échue(s) immobilisent ${overdue.reduce((s,r)=>s+n(r.total),0).toLocaleString("fr-FR")} GNF.`]:[]),...(lateProjects.length?[`${lateProjects.length} projet(s) ont dépassé leur échéance.`]:[]),...(forecast30<0?["La projection de trésorerie à 30 jours devient négative dans ce scénario."]:[])];
      const recommendations=[delay>15?"Accélérer les relances et demander un acompte sur les nouveaux projets.":"Maintenir un suivi hebdomadaire des encaissements.",expenseDelta>10?"Valider toute nouvelle dépense non contractuelle avant engagement.":"Conserver le contrôle actuel des dépenses.",contract>0?"Planifier immédiatement la capacité nécessaire pour le nouveau contrat.":"Développer le pipeline commercial pour sécuriser les trois prochains mois."];
      const result={generated_at:now.toISOString(),kpis:{billed,collected,expenses:spent,cash:collected-spent,receivables:Math.max(0,billed-collected),forecast_30d:forecast30,forecast_90d:forecast30*3,margin_rate:collected?Math.round((collected-spent)/collected*100):0},projections,risks,recommendations};
      let scenario=null;
      if(String(body.name||"").trim()){
        const {data,error}=await admin.from("agency_scenarios").insert({owner_id:user.id,name:String(body.name).trim(),parameters:{client_delay_days:delay,new_contract_value:contract,expense_change_percent:expenseDelta},result}).select().single();if(error)throw error;scenario=data;
      }
      await admin.from("activity_logs").insert({actor_id:user.id,action:"SIMULATE",entity_type:"digital_twin",entity_id:scenario?.id||null,metadata:{delay,contract,expenseDelta}});
      return json(request,{...result,scenario});
    }

    if(mode==="commercial_radar"){
      if(!roles.some(role=>["SUPER_ADMIN","ADMIN","MANAGER","COMMERCIAL"].includes(role)))return json(request,{error:"Accès commercial requis"},403);
      const clientRows=clients.map(client=>{
        const ownInvoices=invoices.filter(row=>row.client_id===client.id),ownProjects=projects.filter(row=>row.client_id===client.id),invoiceIds=new Set(ownInvoices.map(row=>row.id));
        const revenue=ownInvoices.reduce((s,r)=>s+n(r.total),0),paid=payments.filter(row=>invoiceIds.has(row.invoice_id)).reduce((s,r)=>s+n(r.amount),0),overdue=ownInvoices.filter(row=>!["PAYEE","ANNULEE"].includes(row.status)&&row.due_date&&new Date(row.due_date)<now);
        const stalled=ownProjects.filter(row=>!["TERMINE","ANNULE"].includes(row.status)&&n(row.progress)<35&&row.created_at&&new Date(row.created_at).getTime()<now.getTime()-30*day).length;
        const hasRecentActivity=activities.some(row=>row.entity_id===client.id&&new Date(row.created_at).getTime()>now.getTime()-30*day);
        const score=clamp(100-overdue.length*22-stalled*12-(hasRecentActivity?0:10)-(client.status==="ACTIVE"?0:15));
        return{client_id:client.id,client_name:client.name,score,status:score>=75?"SAIN":score>=45?"A_SURVEILLER":"CRITIQUE",revenue,receivables:Math.max(0,revenue-paid),overdue_invoices:overdue.length,active_projects:ownProjects.filter(row=>!["TERMINE","ANNULE"].includes(row.status)).length,recommendation:overdue.length?"Programmer une relance de paiement personnalisée.":stalled?"Organiser un point projet et revalider les priorités.":hasRecentActivity?"Proposer une extension de service ou un renouvellement.":"Reprendre contact avec un bilan de valeur."};
      }).sort((a,b)=>a.score-b.score);
      const stageWeight:Record<string,number>={NOUVEAU:35,CONTACTE:50,QUALIFIE:68,PROPOSITION:82,NEGOCIATION:90,GAGNE:100,PERDU:5};
      const prospectRows=prospects.map(row=>{const signals:string[]=[];let score=stageWeight[row.stage]??35;if(row.email){score+=4;signals.push("E-mail disponible")}if(row.phone){score+=4;signals.push("Téléphone disponible")}if(row.marketing_opt_in){score+=5;signals.push("Consentement marketing")}if(row.next_follow_up_at&&new Date(row.next_follow_up_at)<=now){score+=6;signals.push("Relance arrivée à échéance")}if(row.last_contact_at&&new Date(row.last_contact_at).getTime()>now.getTime()-14*day){score+=4;signals.push("Échange récent")}score=clamp(score);return{prospect_id:row.id,company:row.company,contact_name:row.contact_name,stage:row.stage,score,signals,recommended_action:score>=80?"Appeler aujourd’hui et proposer le prochain engagement.":score>=60?"Envoyer une preuve de valeur puis planifier un appel.":"Qualifier le besoin et obtenir un canal de contact fiable."}}).sort((a,b)=>b.score-a.score);
      const summary={healthy:clientRows.filter(r=>r.status==="SAIN").length,watch:clientRows.filter(r=>r.status==="A_SURVEILLER").length,critical:clientRows.filter(r=>r.status==="CRITIQUE").length,hot_prospects:prospectRows.filter(r=>r.score>=80&&!['GAGNE','PERDU'].includes(r.stage)).length};
      await admin.from("activity_logs").insert({actor_id:user.id,action:"ANALYZE",entity_type:"commercial_radar",metadata:summary});
      return json(request,{generated_at:now.toISOString(),clients:clientRows,prospects:prospectRows,summary});
    }

    if(mode==="campaign_plan"){
      if(!roles.some(role=>["SUPER_ADMIN","ADMIN","MANAGER","COMMERCIAL","COMMUNITY_MANAGER"].includes(role)))return json(request,{error:"Accès communication requis"},403);
      const name=String(body.name||"Campagne sans titre"),objective=String(body.objective||""),audience=String(body.audience||""),offer=String(body.offer||""),tone=String(body.tone||"PROFESSIONNEL"),channels=Array.isArray(body.channels)?body.channels.map(String):["EMAIL"],budget=Math.max(0,n(body.budget)),currency=String(body.currency||"GNF");
      if(!objective.trim()||!audience.trim())return json(request,{error:"Objectif et audience obligatoires"},400);
      const fallback={summary:`Campagne ${name} conçue pour ${audience}, avec validation humaine avant toute diffusion.`,audience_strategy:`Segmenter ${audience} selon le niveau d'intérêt et exclure toute personne sans consentement valide.`,channels,variants:channels.flatMap(channel=>[{channel,name:"Angle valeur",subject:channel==="EMAIL"?`${name} — une solution concrète pour vous`:"",message:`Bonjour, ${objective}. ${offer||"Découvrez notre proposition adaptée à vos besoins."}`,cta:"Répondre pour en savoir plus"},{channel,name:"Angle urgence douce",subject:channel==="EMAIL"?`Une opportunité à découvrir — ${name}`:"",message:`Une opportunité pensée pour ${audience}. ${offer||"Échangeons pour construire la solution la plus adaptée."}`,cta:"Réserver un échange"}]),schedule:[{offset_hours:0,channel:channels[0]||"EMAIL",purpose:"Annonce principale"},{offset_hours:48,channel:channels[1]||channels[0]||"SMS",purpose:"Rappel avec bénéfice concret"},{offset_hours:120,channel:channels[0]||"EMAIL",purpose:"Dernière relance non intrusive"}],kpis:["Taux de livraison","Taux de réponse","Rendez-vous obtenus","Conversions","Coût par conversion"],safeguards:["Validation humaine obligatoire","Audience consentante uniquement","Lien de désinscription pour les e-mails","Plafond budgétaire respecté"]};
      const schema={type:"object",additionalProperties:false,properties:{summary:{type:"string"},audience_strategy:{type:"string"},channels:{type:"array",items:{type:"string"}},variants:{type:"array",items:{type:"object",additionalProperties:false,properties:{channel:{type:"string"},name:{type:"string"},subject:{type:"string"},message:{type:"string"},cta:{type:"string"}},required:["channel","name","subject","message","cta"]}},schedule:{type:"array",items:{type:"object",additionalProperties:false,properties:{offset_hours:{type:"number"},channel:{type:"string"},purpose:{type:"string"}},required:["offset_hours","channel","purpose"]}},kpis:{type:"array",items:{type:"string"}},safeguards:{type:"array",items:{type:"string"}}},required:["summary","audience_strategy","channels","variants","schedule","kpis","safeguards"]};
      const ai=await structuredAi("Tu es un stratège marketing senior pour une agence de communication à Conakry. Produis un plan en français, concret et fidèle aux données. Aucun envoi ne doit être présenté comme exécuté. Les messages doivent être courts, respectueux et sans promesse trompeuse.",JSON.stringify({name,objective,audience,offer,tone,channels,budget,currency}),"campaign_plan",schema);
      const plan=ai||fallback;
      const {data:draft,error}=await admin.from("campaign_ai_drafts").insert({owner_id:user.id,name,objective,audience,offer:offer||null,channels,tone,budget,currency,status:"A_VALIDER",plan}).select().single();if(error)throw error;
      await admin.from("activity_logs").insert({actor_id:user.id,action:"GENERATE",entity_type:"campaign_ai_draft",entity_id:draft.id,metadata:{channels,budget}});
      return json(request,{draft});
    }
    return json(request,{error:"Mode inconnu"},400);
  }catch(error){return edgeError(request,error)}
});
