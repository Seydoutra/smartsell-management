import { supabase } from './supabase'
import type { Client, CreativeApproval, EditorialItem, Project, SocialIntegration } from '../types/models'
import { validateTenantId, isSafeWebUrl, validateEditorialTransition, editorialStatuses } from '../lib/smartSocial'

// Defence in depth only: Supabase RLS remains the authorization boundary.
const db=()=>{if(!supabase)throw new Error('Supabase n’est pas configuré.');return supabase}
const fail=(error:{message:string}|null)=>{if(error)throw new Error(error.message)}
export type SocialEditorialData={items:EditorialItem[];approvals:CreativeApproval[];clients:Client[];projects:Project[]}
export async function loadSocialEditorial(tenantOwnerId:string):Promise<SocialEditorialData> {
  const tenant=validateTenantId(tenantOwnerId),client=db()
  const [items,approvals,clients,projects]=await Promise.all([
    client.from('editorial_items').select('*,clients(name),projects(name)').eq('tenant_owner_id',tenant).order('publish_at',{ascending:true}),
    client.from('creative_approvals').select('*,clients(name)').eq('tenant_owner_id',tenant).order('created_at',{ascending:false}),
    client.from('clients').select('id,name').eq('tenant_owner_id',tenant).order('name'),
    client.from('projects').select('id,name,client_id').eq('tenant_owner_id',tenant).order('name'),
  ])
  for(const response of [items,approvals,clients,projects])fail(response.error)
  return {items:items.data||[],approvals:approvals.data||[],clients:(clients.data||[]) as Client[],projects:(projects.data||[]) as Project[]}
}
export async function loadSocialConnections(tenantOwnerId:string) {
  const tenant=validateTenantId(tenantOwnerId),client=db()
  const [connections,clients]=await Promise.all([
    client.from('social_integrations').select('id,client_id,provider,account_name,account_url,status,metrics,last_synced_at,created_at').eq('tenant_owner_id',tenant).order('provider'),
    client.from('clients').select('id,name').eq('tenant_owner_id',tenant).order('name'),
  ])
  fail(connections.error);fail(clients.error)
  return {connections:(connections.data||[]) as SocialIntegration[],clients:(clients.data||[]) as Client[]}
}
export async function saveSocialReference(tenantOwnerId:string,input:Pick<SocialIntegration,'provider'|'client_id'|'account_name'|'account_url'> & {id?:string}) {
  const tenant=validateTenantId(tenantOwnerId),client=db()
  if(!input.account_name?.trim())throw new Error('Renseignez le nom de la page ou du compte.')
  if(input.account_url&&!isSafeWebUrl(input.account_url))throw new Error('Utilisez une URL publique http ou https valide.')
  if(input.client_id){const result=await client.from('clients').select('id').eq('tenant_owner_id',tenant).eq('id',input.client_id).single();fail(result.error);if(!result.data)throw new Error('Client introuvable dans cet espace.')}
  // Never claim an OAuth connection or manufacture metrics from a manual entry.
  const values={provider:input.provider,client_id:input.client_id,account_name:input.account_name.trim(),account_url:input.account_url||null}
  const query=input.id
    ?client.from('social_integrations').update(values).eq('tenant_owner_id',tenant).eq('id',input.id).eq('status','NON_CONFIGURE')
    :client.from('social_integrations').insert({...values,tenant_owner_id:tenant,status:'NON_CONFIGURE'})
  const result=await query.select('id').single();fail(result.error);return result.data
}
export async function deleteSocialReference(tenantOwnerId:string,id:string) {
  const result=await db().from('social_integrations').delete().eq('tenant_owner_id',validateTenantId(tenantOwnerId)).eq('id',id).eq('status','NON_CONFIGURE').select('id').single()
  fail(result.error);return result.data
}

async function checkEditorialReferences(tenant:string,input:Partial<EditorialItem>) {
  const client=db()
  if(input.client_id){const result=await client.from('clients').select('id').eq('tenant_owner_id',tenant).eq('id',input.client_id).single();fail(result.error)}
  if(input.project_id){const result=await client.from('projects').select('id,client_id').eq('tenant_owner_id',tenant).eq('id',input.project_id).single();fail(result.error);if(result.data?.client_id!==input.client_id)throw new Error('Le projet doit appartenir au client sélectionné.')}
}
export async function saveSocialEditorial(tenantOwnerId:string,input:Partial<EditorialItem>,id?:string) {
  const tenant=validateTenantId(tenantOwnerId),client=db()
  if(!input.title?.trim())throw new Error('Renseignez le titre de la publication.')
  if((input.asset_urls||[]).some(url=>!isSafeWebUrl(url))||Object.values(input.platform_links||{}).some(url=>!isSafeWebUrl(url)))throw new Error('Un lien de visuel ou de publication est invalide.')
  if(!editorialStatuses.includes(input.status as typeof editorialStatuses[number]))throw new Error('Statut éditorial invalide.')
  if(input.publish_at&&!Number.isFinite(new Date(input.publish_at).getTime()))throw new Error('Date invalide.')
  if(['PLANIFIE','PUBLIE'].includes(input.status||'')&&!input.publish_at)throw new Error('Renseignez la date et l’heure de diffusion.')
  await checkEditorialReferences(tenant,input)
  let previous:EditorialItem|undefined
  let approvals:CreativeApproval[]=[]
  if(id){
    const result=await client.from('editorial_items').select('*').eq('tenant_owner_id',tenant).eq('id',id).single();fail(result.error);previous=result.data as EditorialItem
    const reviews=await client.from('creative_approvals').select('*').eq('tenant_owner_id',tenant).eq('editorial_item_id',id);fail(reviews.error);approvals=reviews.data||[]
  }
  const issue=validateEditorialTransition(previous,input,approvals);if(issue)throw new Error(issue)
  // Explicit allowlist: no ids, tenant reassignment, nested relations or audit fields.
  const values={title:input.title.trim(),client_id:input.client_id||null,project_id:input.project_id||null,
    platform:input.platform||null,platforms:input.platforms||[],platform_links:input.platform_links||{},
    asset_urls:input.asset_urls||[],content_type:input.content_type||'',caption:input.caption||'',
    canva_design_id:input.canva_design_id||null,canva_design_title:input.canva_design_title||null,
    publish_at:input.publish_at||null,status:input.status,theme:input.theme||'',post_type:input.post_type||'',
    objective:input.objective||'',visual_title:input.visual_title||'',visual_subtitle:input.visual_subtitle||'',
    hashtags:input.hashtags||'',production_notes:input.production_notes||'',week_label:input.week_label||''}
  const query=id?client.from('editorial_items').update(values).eq('tenant_owner_id',tenant).eq('id',id):client.from('editorial_items').insert({...values,tenant_owner_id:tenant})
  const result=await query.select('*').single();fail(result.error);return result.data as EditorialItem
}
export async function deleteSocialEditorial(tenantOwnerId:string,id:string) {
  const result=await db().from('editorial_items').delete().eq('tenant_owner_id',validateTenantId(tenantOwnerId)).eq('id',id).select('id').single();fail(result.error)
}
export async function importSocialEditorial(tenantOwnerId:string,items:Partial<EditorialItem>[]) {
  const tenant=validateTenantId(tenantOwnerId)
  if(!items.length)return 0
  for(const item of items){
    if(!['A_REDIGER','EN_CREATION'].includes(item.status||''))throw new Error('Les nouveaux contenus importés doivent être en préparation avant validation client.')
    await checkEditorialReferences(tenant,item)
  }
  const result=await db().from('editorial_items').insert(items.map(item=>({...item,tenant_owner_id:tenant})))
  fail(result.error);return items.length
}
