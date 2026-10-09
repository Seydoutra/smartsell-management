import { supabase } from './supabase'
import { validateTenantId } from '../lib/smartSocial'
import { socialMeasures, socialNetworks, validMonth, type ContractCommitment, type MonthlyCommitment, type MonthlyReport, type SocialMeasurement } from '../lib/clientSocialReporting'
import type { EditorialItem } from '../types/models'
const db=()=>{if(!supabase)throw new Error('Supabase n’est pas configuré.');return supabase}
const fail=(error:{message:string}|null)=>{if(error)throw new Error(error.message)}
export async function loadClientSocialReporting(tenantOwnerId:string,clientId:string) {
  const tenant=validateTenantId(tenantOwnerId)
  const query=(table:string)=>db().from(table).select('*').eq('tenant_owner_id',tenant).eq('client_id',clientId)
  const result=await Promise.all([query('client_social_measurements').order('measured_on'),query('client_monthly_commitments').order('month',{ascending:false}),query('client_monthly_reports').order('month',{ascending:false}),query('editorial_items').order('publish_at'),query('client_service_commitments').order('effective_month',{ascending:false})])
  for(const row of result)fail(row.error)
  return {measurements:(result[0].data||[]) as SocialMeasurement[],commitments:(result[1].data||[]) as MonthlyCommitment[],reports:(result[2].data||[]) as MonthlyReport[],items:(result[3].data||[]) as EditorialItem[],contracts:(result[4].data||[]) as ContractCommitment[]}
}
export async function saveClientSocialMeasurement(tenantOwnerId:string,clientId:string,input:Partial<SocialMeasurement>,id?:string) {
  const tenant=validateTenantId(tenantOwnerId)
  if(!socialNetworks.includes(input.network as typeof socialNetworks[number])||!input.account_key?.trim()||!['BASELINE','SNAPSHOT'].includes(input.kind||''))throw new Error('Réseau, compte ou type de mesure invalide.')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.measured_on||'')||!Number.isFinite(Date.parse(input.measured_on!))||input.measured_on!>new Date().toISOString().slice(0,10))throw new Error('Saisissez une date de mesure valide, non future.')
  const metrics=Object.fromEntries(socialMeasures.map(([key])=>{const value=input[key]??null;if(value!==null&&(!Number.isSafeInteger(value)||value<0))throw new Error('Les statistiques doivent être des entiers positifs, ou non renseignées.');return [key,value]}))
  const values={network:input.network,account_key:input.account_key.trim(),kind:input.kind,measured_on:input.measured_on,notes:input.notes?.trim()||null,...metrics}
  const query=id?db().from('client_social_measurements').update(values).eq('tenant_owner_id',tenant).eq('client_id',clientId).eq('id',id):db().from('client_social_measurements').insert({...values,tenant_owner_id:tenant,client_id:clientId})
  const result=await query.select('id').single();fail(result.error)
}
export async function saveClientMonthlyCommitment(tenantOwnerId:string,clientId:string,input:{month:string;publications:number;videos:number;reels:number;notes:string},id?:string) {
  if(!validMonth(input.month)||[input.publications,input.videos,input.reels].some(value=>!Number.isSafeInteger(value)||value<0))throw new Error('Mois ou objectifs invalides.')
  const tenant=validateTenantId(tenantOwnerId),values={month:`${input.month}-01`,publications:input.publications,videos:input.videos,reels:input.reels,notes:input.notes.trim()||null}
  const query=id?db().from('client_monthly_commitments').update(values).eq('tenant_owner_id',tenant).eq('client_id',clientId).eq('id',id):db().from('client_monthly_commitments').insert({...values,tenant_owner_id:tenant,client_id:clientId})
  const result=await query.select('id').single();fail(result.error)
}
export async function generateClientMonthlyReport(clientId:string,month:string) {
  if(!validMonth(month))throw new Error('Mois invalide.')
  const result=await db().rpc('generate_client_monthly_report',{p_client:clientId,p_month:`${month}-01`});fail(result.error);return result.data as string
}
export async function saveClientServiceCommitment(tenantOwnerId:string,clientId:string,input:{month:string;publications:number;videos:number;reels:number;notes:string},id?:string) {
  if(!validMonth(input.month)||[input.publications,input.videos,input.reels].some(value=>!Number.isSafeInteger(value)||value<0))throw new Error('Mois ou engagements invalides.')
  const tenant=validateTenantId(tenantOwnerId),values={effective_month:`${input.month}-01`,publications:input.publications,videos:input.videos,reels:input.reels,notes:input.notes.trim()||null}
  const query=id?db().from('client_service_commitments').update(values).eq('tenant_owner_id',tenant).eq('client_id',clientId).eq('id',id):db().from('client_service_commitments').insert({...values,tenant_owner_id:tenant,client_id:clientId})
  const result=await query.select('id').single();fail(result.error)
}
