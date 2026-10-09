import { supabase } from './supabase'
import { validateTenantId } from '../lib/smartSocial'
import type { CommandKind } from '../lib/actionCommand'
import type { Client, Profile, Project, Service } from '../types/models'
const db=()=>{if(!supabase)throw new Error('Supabase n’est pas configuré.');return supabase}
export async function verifyCommandSession(profileId:string,tenantOwnerId:string){
  const tenant=validateTenantId(tenantOwnerId),client=db()
  const {data,error}=await client.auth.getUser()
  if(error||data.user?.id!==profileId)throw new Error('La session a changé. Reconnectez-vous avant de continuer.')
  const result=await client.from('profiles').select('id,tenant_owner_id,active,role,roles').eq('id',profileId).single()
  if(result.error)throw new Error(result.error.message)
  if(!result.data?.active||(result.data.tenant_owner_id||result.data.id)!==tenant||result.data.role==='CLIENT'||result.data.roles?.includes('CLIENT'))throw new Error('Création non autorisée dans cet espace.')
}
export async function loadCommandReferences(profileId:string,tenantOwnerId:string,kind:CommandKind,allowed:(key:string)=>boolean){
  await verifyCommandSession(profileId,tenantOwnerId)
  const tenant=validateTenantId(tenantOwnerId)
  const read=async<T>(table:string,select:string):Promise<T[]>=>{
    const {data,error}=await db().from(table).select(select).eq('tenant_owner_id',tenant)
    if(error)throw new Error(error.message)
    return (data||[]) as T[]
  }
  const billing=kind==='FACTURE'||kind==='DEVIS'
  const [clients,projects,profiles,services]=await Promise.all([
    (kind==='PROJECT'||billing)&&allowed('clients.view')?read<Client>('clients','id,name'):[],
    (kind==='TASK'||billing)&&allowed('projects.view')?read<Project>('projects','id,name,client_id'):[],
    ((kind==='TASK'&&allowed('tasks.assign'))||(kind==='PROJECT'&&allowed('projects.update')))?read<Profile>('profiles','id,full_name,active,role,roles,tenant_owner_id'):[],
    billing&&allowed('services.view')?read<Service>('service_catalog','id,name,active,category,unit_price,currency,tax_rate'):[],
  ])
  return {clients,projects,profiles:profiles.filter(p=>p.active&&p.role!=='CLIENT'&&!p.roles?.includes('CLIENT')),services}
}
