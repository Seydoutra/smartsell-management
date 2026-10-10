import {supabase} from './supabase'
import {invalidateBillingDocuments} from './repository'
export type FlowJob={id:string;kind:'PROSPECT_CLIENT'|'QUOTE_DELIVERY';source_id:string;status:'A_VALIDER'|'TERMINE'|'IGNORE'|'ERREUR';title:string|null;error:string|null;result:{client_id?:string;project_id?:string;invoice_id?:string;task_ids?:string[]}}
export type FlowQuote={id:string;number:string;client_id:string;status:string;project_id:string|null;items:{id:string;description:string}[]}
export type FlowState={jobs:FlowJob[];quotes:FlowQuote[];clients:{id:string;name:string}[];staff:{id:string;name:string}[];events:{id:string;kind:string;source_id:string;event:string;detail:string;created_at:string}[];rights:{view_projects?:boolean;view_tasks?:boolean;view_billing?:boolean;convert:boolean;accept_quote:boolean;delivery:boolean;tasks:boolean;invoice:boolean}}
const rpc=async<T,>(name:string,args?:Record<string,unknown>):Promise<T>=>{if(!supabase)throw new Error('Supabase non configuré');const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.message);return data as T}
export const loadOrchestration=()=>rpc<FlowState>('orchestration_workspace')
export const analyzeOrchestration=()=>rpc<void>('analyze_commercial_orchestration')
export const confirmQuoteAcceptance=(id:string,note:string)=>rpc<void>('confirm_quote_acceptance',{p_quote:id,p_note:note})
export async function executeOrchestration(id:string,payload:Record<string,unknown>){const r=await rpc<{ok:boolean;error?:string;result:FlowJob['result'];reused?:boolean}>('execute_commercial_orchestration',{p_job:id,p_payload:payload});if(!r.ok)throw new Error(r.error||'Exécution refusée');invalidateBillingDocuments();return r}
