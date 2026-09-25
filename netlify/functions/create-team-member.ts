import { createClient } from '@supabase/supabase-js'

export default async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return Response.json({ error: 'Configuration serveur manquante' }, { status: 500 })
  const auth = request.headers.get('authorization')
  if (!auth) return Response.json({ error: 'Non authentifié' }, { status: 401 })
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const token = auth.replace('Bearer ', '')
  const { data: caller } = await admin.auth.getUser(token)
  if (!caller.user) return Response.json({ error: 'Session invalide' }, { status: 401 })
  const { data: profile } = await admin.from('profiles').select('role').eq('id', caller.user.id).single()
  if (!profile || !['SUPER_ADMIN','ADMIN'].includes(profile.role)) return Response.json({ error: 'Permission refusée' }, { status: 403 })
  const body = await request.json() as { email:string; password:string; name:string; role:string; department_id?:string }
  const { data, error } = await admin.auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true, user_metadata: { name: body.name } })
  if (error || !data.user) return Response.json({ error: error?.message || 'Création impossible' }, { status: 400 })
  await admin.from('profiles').upsert({ id:data.user.id, full_name:body.name, role:body.role, department_id:body.department_id||null, must_change_password:true })
  return Response.json({ id:data.user.id }, { status: 201 })
}
