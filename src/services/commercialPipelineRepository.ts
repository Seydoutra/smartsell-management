import { supabase } from './supabase'
import { validateTenantId } from '../lib/smartSocial'
import { commercialStages } from '../lib/commercialPipeline'
import type { Prospect, Service } from '../types/models'

const db=()=>{if(!supabase)throw new Error('Supabase n’est pas configuré.');return supabase}
const fail=(error:{message:string}|null)=>{if(error)throw new Error(error.message)}
// Explicit tenant filters are defence in depth, never a replacement for RLS.
export async function loadCommercialProspects(tenantOwnerId:string):Promise<Prospect[]> {
  const tenant=validateTenantId(tenantOwnerId)
  const result=await db().from('prospects').select('*').eq('tenant_owner_id',tenant).order('created_at',{ascending:false})
  fail(result.error);return result.data||[]
}
export async function loadCommercialOffers(tenantOwnerId:string):Promise<Service[]> {
  const tenant=validateTenantId(tenantOwnerId)
  const result=await db().from('service_catalog').select('id,name,category,description,active').eq('tenant_owner_id',tenant).eq('active',true).order('name')
  fail(result.error);return (result.data||[]) as Service[]
}
export async function saveCommercialProspect(tenantOwnerId:string,input:Partial<Prospect>,id?:string):Promise<Prospect> {
  const tenant=validateTenantId(tenantOwnerId)
  if(!input.company?.trim())throw new Error('Renseignez le nom du prospect.')
  if(!commercialStages.some(([stage])=>stage===input.stage))throw new Error('Étape commerciale invalide.')
  for(const value of [input.last_contact_at,input.next_follow_up_at])if(value&&!Number.isFinite(Date.parse(value)))throw new Error('Date commerciale invalide.')
  const values={company:input.company.trim(),contact_name:input.contact_name?.trim()||null,phone:input.phone?.trim()||null,
    email:input.email?.trim()||null,whatsapp:input.whatsapp?.trim()||null,sector:input.sector?.trim()||null,
    source:input.source?.trim()||null,need:input.need?.trim()||null,stage:input.stage,notes:input.notes?.trim()||null,
    last_contact_at:input.last_contact_at||null,next_follow_up_at:input.next_follow_up_at||null,
    sms_opt_in:Boolean(input.sms_opt_in),email_opt_in:Boolean(input.email_opt_in),marketing_opt_in:Boolean(input.marketing_opt_in)}
  const query=id?db().from('prospects').update(values).eq('tenant_owner_id',tenant).eq('id',id):db().from('prospects').insert({...values,tenant_owner_id:tenant})
  const result=await query.select('*').single();fail(result.error);return result.data as Prospect
}
export async function moveCommercialProspect(tenantOwnerId:string,id:string,stage:string):Promise<Prospect> {
  const tenant=validateTenantId(tenantOwnerId)
  if(!commercialStages.some(([value])=>value===stage))throw new Error('Étape commerciale invalide.')
  const result=await db().from('prospects').update({stage}).eq('tenant_owner_id',tenant).eq('id',id).select('*').single()
  fail(result.error);return result.data as Prospect
}
