import {adminClient,json,handleOptions,corsHeaders} from '../_shared/http.ts';
import {sendNimbaSms} from '../_shared/nimba.ts';
import {automatedRecipientEligible} from '../_shared/notificationEligibility.ts';
import {invoiceReminderMessage,publicInvoiceHtml} from '../_shared/invoice-reminders.ts';
Deno.serve(async request=>{
 const options=handleOptions(request);if(options)return options;
 const admin=adminClient();
 const token=new URL(request.url).searchParams.get('token');
 if(request.method==='GET'&&token){
  const headers={...corsHeaders(request),'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
  if(!/^[a-f0-9]{48}$/.test(token))return new Response('Facture indisponible',{status:404,headers});
  const {data:link,error}=await admin.from('invoice_public_links').select('invoice_id').eq('token',token).eq('active',true).maybeSingle();
  if(error)return new Response('Consultation temporairement indisponible',{status:503,headers});
  if(!link)return new Response('Facture indisponible',{status:404,headers});
  const {data:i,error:invoiceError}=await admin.from('invoices').select('number,issue_date,due_date,currency,total,tenant_owner_id,client_id,invoice_items(description,quantity,unit_price),clients(name,tenant_owner_id),payments(amount,tenant_owner_id)').eq('id',link.invoice_id).single();
  if(invoiceError||!i||i.clients?.tenant_owner_id!==i.tenant_owner_id)return new Response('Facture indisponible',{status:404,headers});
  const paid=(i.payments||[]).filter((p:any)=>p.tenant_owner_id===i.tenant_owner_id).reduce((s:number,p:any)=>s+Number(p.amount),0);
  if(new URL(request.url).searchParams.get('format')==='json')return new Response(JSON.stringify({html:publicInvoiceHtml(i,paid)}),{headers:{...corsHeaders(request),...headers,'content-type':'application/json; charset=utf-8'}});
  return new Response(publicInvoiceHtml(i,paid),{headers});
 }
 const bearer=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 if(request.method!=='POST'||!((Deno.env.get('CRON_SECRET')&&request.headers.get('x-cron-secret')===Deno.env.get('CRON_SECRET'))||(bearer&&bearer===Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))))return json(request,{error:'Non autorisé'},401);
 try{
  const {data:jobs,error}=await admin.from('invoice_sms_reminders').select('id,tenant_owner_id').eq('status','PENDING').lte('scheduled_for',new Date().toISOString()).order('scheduled_for').limit(50);if(error)throw error;
  let sent=0,failed=0;
  for(const job of jobs||[]){
   if(!await automatedRecipientEligible(admin,job.tenant_owner_id,job.tenant_owner_id))continue;
   const {data:r,error:claimError}=await admin.rpc('claim_invoice_sms',{p_id:job.id});if(claimError)throw claimError;if(!r)continue;
   try{
    const url=`https://seydoutra.github.io/smartsell-management/#invoice?token=${r.token}`;
    const phone=Deno.env.get('COMMUNICATION_TEST_MODE')==='true'?Deno.env.get('COMMUNICATION_TEST_PHONE'):r.phone;
    if(!phone)throw new Error('Téléphone manquant');
    const result=await sendNimbaSms([phone],invoiceReminderMessage(r,url),r.tenant_owner_id);
    const {error:saveError}=await admin.from('invoice_sms_reminders').update({status:'SENT',sent_at:new Date().toISOString(),provider_message_id:result.uid||result.id||null,error:null}).eq('id',job.id).eq('status','SENDING');
    if(saveError)throw new Error('Envoi traité, confirmation locale impossible. Vérification manuelle requise, ne pas renvoyer.');sent++;
   }catch(e){failed++;await admin.from('invoice_sms_reminders').update({status:'FAILED',error:e instanceof Error?e.message:'Envoi impossible — vérifier avant tout nouvel envoi'}).eq('id',job.id).eq('status','SENDING');}
  }
  return json(request,{processed:jobs?.length||0,sent,failed});
 }catch(e){return json(request,{error:e instanceof Error?e.message:'Erreur serveur'},500);}
});
