import { createClient } from '@supabase/supabase-js'

export const config = { schedule: '*/15 * * * *' }

export default async () => {
  const url=process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key) return Response.json({error:'Configuration Supabase manquante'},{status:500})
  const admin=createClient(url,key,{auth:{persistSession:false}})
  const now=new Date(), horizon=new Date(now.getTime()+24*60*60*1000)
  const {data:tasks,error}=await admin.from('tasks').select('id,title,due_at,reminder_minutes,notification_channels,assignee_id,profiles:assignee_id(full_name,phone,notification_preferences)').neq('status','TERMINE').is('reminder_sent_at',null).gte('due_at',now.toISOString()).lte('due_at',horizon.toISOString())
  if(error) return Response.json({error:error.message},{status:500})
  let queued=0
  for(const task of tasks||[]){
    const due=new Date(task.due_at), sendAt=new Date(due.getTime()-Number(task.reminder_minutes||30)*60_000)
    if(sendAt>now) continue
    const channels=(task.notification_channels?.length?task.notification_channels:['IN_APP']) as string[]
    for(const channel of channels){
      await admin.from('reminder_deliveries').upsert({task_id:task.id,profile_id:task.assignee_id,channel,scheduled_for:sendAt.toISOString(),status:channel==='IN_APP'?'DELIVERED':'QUEUED'},{onConflict:'task_id,channel,scheduled_for'})
      if(channel==='IN_APP'&&task.assignee_id) await admin.from('notifications').insert({profile_id:task.assignee_id,channel:'IN_APP',title:`Rappel : ${task.title}`,body:`Échéance ${due.toLocaleString('fr-FR')}`,entity_type:'task',entity_id:task.id})
      queued++
    }
    await admin.from('tasks').update({reminder_sent_at:now.toISOString()}).eq('id',task.id)
  }
  return Response.json({processed:tasks?.length||0,queued})
}
