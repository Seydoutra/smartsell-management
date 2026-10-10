import {supabase} from './supabase'
import type {Invoice,Quote} from '../types/models'
import {invalidateBillingDocuments} from './repository'
const db=()=>{if(!supabase)throw new Error('Connexion indisponible');return supabase}
const checked=<T,>(result:{data:T;error:{message:string}|null})=>{if(result.error)throw new Error(result.error.message);return result.data}
export type BrandData={logo_url:string;colors:string;fonts:string;tone:string;audience:string;offers:string;objectives:string;avoid:string;contacts:string;links:string}
export type BrandRecord={client_id:string;data:BrandData;revision:number;updated_at:string}
export const emptyBrand:BrandData={logo_url:'',colors:'',fonts:'',tone:'',audience:'',offers:'',objectives:'',avoid:'',contacts:'',links:''}
export async function loadClientBrand(clientId:string){return checked(await db().from('client_brand_profiles').select('*').eq('client_id',clientId).maybeSingle()) as BrandRecord|null}
export async function saveClientBrand(clientId:string,data:BrandData,revision:number){
 if(data.logo_url&&!/^https:\/\//i.test(data.logo_url))throw new Error('Le logo doit utiliser un lien HTTPS.');
 return checked(await db().rpc('save_client_brand',{p_client_id:clientId,p_data:data,p_revision:revision})) as BrandRecord
}
export async function startClientDelivery(quoteId:string,name:string,starts:string,ends:string){const id=checked(await db().rpc('start_client_delivery',{p_quote_id:quoteId,p_name:name,p_starts_on:starts,p_ends_on:ends})) as string;invalidateBillingDocuments();return id}
export async function requestEditorialReview(id:string){return checked(await db().rpc('request_editorial_review',{p_editorial_id:id})) as string}
export async function createBillingOnce(operationId:string,kind:'FACTURE'|'DEVIS',payload:Record<string,unknown>){
 const id=checked(await db().rpc('create_billing_document_once',{p_operation_id:operationId,p_kind:kind,p_payload:payload}));
 invalidateBillingDocuments()
 const table=kind==='FACTURE'?'invoices':'quotes',items=kind==='FACTURE'?'invoice_items':'quote_items';
 const response=await db().from(table).select(`*,clients(name,email,address),projects(name),${items}(*)${kind==='FACTURE'?',payments(*)':''}`).eq('id',id).single();
 if(response.error)throw new Error('Le document a été enregistré, mais sa lecture a échoué. Réessayez sans modifier le formulaire : le même document sera récupéré, sans doublon.');
 return response.data as unknown as Invoice|Quote
}
async function draftIdentity(){const {data,error}=await db().auth.getUser();if(error||!data.user)throw new Error('Session expirée');const profile=checked(await db().from('profiles').select('tenant_owner_id').eq('id',data.user.id).single());if(!profile)throw new Error('Profil introuvable');return {author_id:data.user.id,tenant_owner_id:profile.tenant_owner_id||data.user.id}}
export async function readBillingDraft(key:string){const identity=await draftIdentity();return checked(await db().from('form_drafts').select('payload,updated_at').eq('author_id',identity.author_id).eq('draft_key',key).maybeSingle()) as {payload:Record<string,unknown>;updated_at:string}|null}
let draftQueue:Promise<unknown>=Promise.resolve()
function queuedDraft<T>(run:()=>Promise<T>):Promise<T>{const result=draftQueue.catch(()=>{}).then(run);draftQueue=result;return result}
export function writeBillingDraft(key:string,payload:Record<string,unknown>){const identity=draftIdentity();void identity.catch(()=>{});return queuedDraft(async()=>{const captured=await identity;checked(await db().from('form_drafts').upsert({...captured,draft_key:key,payload,updated_at:new Date().toISOString()}));});}
export function clearBillingDraft(key:string){const identity=draftIdentity();void identity.catch(()=>{});return queuedDraft(async()=>{const captured=await identity;checked(await db().from('form_drafts').delete().eq('author_id',captured.author_id).eq('draft_key',key));});}
export type Annotation={id:string;approval_id:string;body:string;x:number|null;y:number|null;time_seconds:number|null;created_at:string}
export async function listCreativeAnnotations(id:string){return checked(await db().from('creative_annotations').select('*').eq('approval_id',id).order('created_at')) as Annotation[]}
export async function addCreativeAnnotation(id:string,body:string,x:number|null,y:number|null,time:number|null){return checked(await db().rpc('add_creative_annotation',{p_approval_id:id,p_body:body,p_x:x,p_y:y,p_time_seconds:time})) as Annotation}
