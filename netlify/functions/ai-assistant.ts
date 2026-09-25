import { createClient } from '@supabase/supabase-js'

export default async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const supabaseUrl=process.env.VITE_SUPABASE_URL, serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY
  const token=request.headers.get('authorization')?.replace('Bearer ','')
  if(!supabaseUrl||!serviceKey||!token) return Response.json({error:'Session ou configuration Supabase manquante'},{status:401})
  const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}})
  const {data:auth}=await admin.auth.getUser(token)
  if(!auth.user) return Response.json({error:'Session invalide'},{status:401})
  const {prompt,context}=await request.json() as {prompt:string;context?:string}
  if(!process.env.OPENAI_API_KEY) return Response.json({error:'Ajoutez OPENAI_API_KEY dans les variables Netlify pour activer l’assistant IA.'},{status:503})
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',reasoning:{effort:'low'},max_output_tokens:1400,instructions:'Tu es le copilote de gestion interne de Smartsell à Conakry. Réponds en français, de façon concise, opérationnelle et prudente. Ne prétends jamais avoir exécuté une action.',input:`Contexte autorisé:
${(context||'').slice(0,6000)}

Demande:
${prompt.slice(0,3000)}`})})
  const body=await response.json() as {output_text?:string;output?:Array<{type?:string;content?:Array<{type?:string;text?:string}>}>;error?:{message?:string}}
  if(!response.ok) return Response.json({error:body.error?.message||'Service IA indisponible'},{status:502})
  const answer=body.output_text||body.output?.flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text||'').join('\n').trim()
  await admin.from('activity_logs').insert({actor_id:auth.user.id,action:'CREATE',entity_type:'ai_assistant',metadata:{prompt:prompt.slice(0,180)}})
  return Response.json({answer:answer||'Aucune réponse générée.'})
}
