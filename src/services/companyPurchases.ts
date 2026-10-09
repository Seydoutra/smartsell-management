import {supabase} from './supabase'
import type {Expense,Project,Supplier} from '../types/models'
export type CompanyPurchase={id:string;title:string;justification:string;estimated_cost:number;currency:string;status:string;created_at:string}
const db=()=>{if(!supabase)throw new Error('Supabase non configuré');return supabase}
export async function loadCompanyCosts(tenant:string,canProjects:boolean,canSuppliers:boolean){
 const [expenses,purchases,projects,suppliers]=await Promise.all([
  db().from('expenses').select('*,suppliers(name)').eq('tenant_owner_id',tenant).order('spent_on',{ascending:false}),
  db().from('purchase_requests').select('*').eq('tenant_owner_id',tenant).order('created_at',{ascending:false}),
  canProjects?db().from('projects').select('*').eq('tenant_owner_id',tenant).order('name'):Promise.resolve({data:[],error:null}),
  canSuppliers?db().from('suppliers').select('*').eq('tenant_owner_id',tenant).order('name'):Promise.resolve({data:[],error:null})
 ]);
 for(const result of [expenses,purchases,projects,suppliers])if(result.error)throw new Error(result.error.message);
 return {expenses:expenses.data as Expense[],purchases:purchases.data as CompanyPurchase[],projects:projects.data as Project[],suppliers:suppliers.data as Supplier[]};
}
export async function saveCompanyExpense(tenant:string,input:Partial<Expense>,id?:string){
 const {data:{user},error:authError}=await db().auth.getUser();if(authError||!user)throw new Error('Reconnectez-vous.');
 const query=id?db().from('expenses').update(input).eq('tenant_owner_id',tenant).eq('id',id):db().from('expenses').insert({...input,tenant_owner_id:tenant,submitted_by:user.id,status:'BROUILLON'});
 const {data,error}=await query.select().single();if(error)throw new Error(error.message);return data as Expense;
}
export async function companyPurchaseAction(action:'CREATE'|'APPROVE'|'REJECT'|'CONVERT',body:Record<string,unknown>){const {data,error}=await db().rpc('company_purchase_action',{p_action:action,p_body:body});if(error)throw new Error(error.message);return data as string}
export async function deleteCompanyExpense(tenant:string,id:string){const {data,error}=await db().from('expenses').delete().eq('tenant_owner_id',tenant).eq('id',id).select('id');if(error)throw new Error(error.message);if(!data?.length)throw new Error('Suppression refusée : vérifiez vos droits et le lien à une demande d’achat.');}
