import {supabase} from './supabase'
export type TreasuryAccount={id:string;name:string;kind:'BANQUE'|'CAISSE'|'MOBILE_MONEY';currency:string;bank_name?:string;account_reference?:string;opening_on:string;active:boolean;balance:number}
export type FinanceRequest={id:string;applicant_id:string;applicant_name:string;kind:string;amount:number;currency:string;reason:string;installments:number;first_due_on:string;status:string;repaid:number;decision_note?:string}
export type FinanceWorkspace={accounts:TreasuryAccount[];entries:{id:string;account_id:string;amount:number;occurred_on:string;description:string;reference?:string}[];requests:FinanceRequest[];rights:{finance:boolean;create_account:boolean;movement:boolean;all_requests:boolean;approve:boolean;submit:boolean;owner:boolean}}
export type WorkspaceSettings={company:Record<string,string|number|null>|null;can_edit:boolean}
async function rpc<T>(name:string,args?:Record<string,unknown>):Promise<T>{if(!supabase)throw new Error('Supabase non configuré');const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.message);return data as T}
export const loadFinance=()=>rpc<FinanceWorkspace>('finance_workspace')
export const financeCommand=(operation:string,action:string,body:Record<string,unknown>)=>rpc<{id:string;action:string}>('finance_command',{p_operation:operation,p_action:action,p_body:body})
export const loadWorkspaceSettings=()=>rpc<WorkspaceSettings>('workspace_settings')
export const saveWorkspaceSettings=(data:Record<string,unknown>,revision:number)=>rpc<Record<string,string|number|null>>('save_workspace_settings',{p_data:data,p_revision:revision})
