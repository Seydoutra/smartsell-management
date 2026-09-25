import { createClient } from '@supabase/supabase-js'
import { sendNimbaSms } from './_shared/nimba'

export default async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const url=process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  const token=request.headers.get('authorization')?.replace('Bearer ','')
  if(!url||!key||!token) return Response.json({error:'Session ou configuration Supabase manquante'},{status:401})
  const admin=createClient(url,key,{auth:{persistSession:false}})
  const {data:auth}=await admin.auth.getUser(token)
  if(!auth.user) return Response.json({error:'Session invalide'},{status:401})
  const body = await request.json() as { channel:'SMS'|'EMAIL'; recipients:string[]; message:string }
  if(!['SMS','EMAIL'].includes(body.channel)||!body.message?.trim()||!Array.isArray(body.recipients)) return Response.json({error:'Message invalide'},{status:400})
  const testMode = process.env.COMMUNICATION_TEST_MODE !== 'false'
  const limit = Number(process.env[body.channel==='SMS'?'MAX_SMS_PER_CAMPAIGN':'MAX_EMAILS_PER_CAMPAIGN'] || 250)
  if (body.recipients.length > limit) return Response.json({ error:`La limite de ${limit} destinataires est dépassée.` }, { status:400 })
  const {data:access}=await admin.from('user_access_controls').select('max_sms_per_day,max_emails_per_day').eq('profile_id',auth.user.id).maybeSingle()
  const dailyLimit=body.channel==='SMS'?Number(access?.max_sms_per_day??0):Number(access?.max_emails_per_day??10)
  const since=new Date();since.setHours(0,0,0,0)
  const {count}=await admin.from('communication_logs').select('id',{count:'exact',head:true}).eq('sent_by',auth.user.id).eq('channel',body.channel).gte('sent_at',since.toISOString()).in('status',['QUEUED','SENT','DELIVERED'])
  if(dailyLimit>=0&&(count||0)+body.recipients.length>dailyLimit) return Response.json({error:`Votre limite quotidienne de ${dailyLimit} ${body.channel.toLowerCase()} est dépassée.`},{status:403})
  const recipients = testMode ? [body.channel==='SMS' ? process.env.COMMUNICATION_TEST_PHONE : process.env.COMMUNICATION_TEST_EMAIL].filter(Boolean) : body.recipients
  if (!recipients.length) return Response.json({ error:'Aucun destinataire de test configuré' }, { status:400 })
  try{
    let provider:{uid?:string;id?:string;status?:string;message_cost?:number;currency?:string}|null=null
    if(body.channel==='SMS') provider=await sendNimbaSms(recipients,body.message.trim())
    else if(!testMode) throw new Error('Le fournisseur e-mail n’est pas encore configuré')
    await admin.from('communication_logs').insert(recipients.map(recipient=>({channel:body.channel,recipient,status:testMode?'QUEUED':'SENT',provider_message_id:provider?.uid||provider?.id||null,sms_cost:provider?.message_cost||null,sms_currency:provider?.currency||null,sent_by:auth.user.id,metadata:{test_mode:testMode,provider:body.channel==='SMS'?'NIMBA':'EMAIL'}})))
    await admin.from('activity_logs').insert({actor_id:auth.user.id,action:body.channel==='SMS'?'SEND_SMS':'SEND_EMAIL',entity_type:'communication',metadata:{recipient_count:recipients.length,test_mode:testMode}})
    return Response.json({status:testMode?'QUEUED':'SENT',testMode,recipientCount:recipients.length,providerMessageId:provider?.uid||provider?.id||null})
  }catch(error){
    const reason=error instanceof Error?error.message:'Envoi impossible'
    await admin.from('communication_logs').insert(recipients.map(recipient=>({channel:body.channel,recipient,status:'FAILED',sent_by:auth.user.id,metadata:{test_mode:testMode,error:reason}})))
    return Response.json({error:reason},{status:502})
  }
}
