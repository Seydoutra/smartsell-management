import { supabase } from './supabase'
import type { Client, Invoice, InvoiceItem, Payment, Profile, Project, Task } from '../types/models'

const db=()=>{if(!supabase)throw new Error('Supabase n’est pas configuré.');return supabase}
const fail=(error:{message:string}|null)=>{if(error)throw new Error(error.message)}

export async function signIn(email:string,password:string){const {data,error}=await db().auth.signInWithPassword({email,password});fail(error);return data}
export async function signOut(){const {error}=await db().auth.signOut();fail(error)}
export async function requestPasswordReset(email:string){const {error}=await db().auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/`});fail(error)}
export async function currentSession(){return (await db().auth.getSession()).data.session}
export function onAuthChange(callback:()=>void){return db().auth.onAuthStateChange(callback).data.subscription}
export async function getProfile():Promise<Profile>{const {data:{user}}=await db().auth.getUser();if(!user)throw new Error('Session expirée');const {data,error}=await db().from('profiles').select('*').eq('id',user.id).single();fail(error);return data as Profile}

export async function listClients():Promise<Client[]>{const {data,error}=await db().from('clients').select('*').order('created_at',{ascending:false});fail(error);return data as Client[]}
export async function createClient(input:Partial<Client>){const {data,error}=await db().from('clients').insert({name:input.name,legal_name:input.legal_name||null,sector:input.sector||null,phone:input.phone||null,whatsapp:input.whatsapp||null,email:input.email||null,address:input.address||null,status:'ACTIVE'}).select().single();fail(error);return data as Client}
export async function listProjects():Promise<Project[]>{const {data,error}=await db().from('projects').select('*,clients(name)').order('created_at',{ascending:false});fail(error);return data as Project[]}
export async function createProject(input:Partial<Project>){const {data,error}=await db().from('projects').insert({name:input.name,client_id:input.client_id||null,type:input.type||'Autre',starts_on:input.starts_on||null,ends_on:input.ends_on||null,budget:Number(input.budget||0),currency:input.currency||'GNF',status:'PLANIFIE',priority:input.priority||'NORMALE',progress:0,description:input.description||null}).select().single();fail(error);return data as Project}
export async function listTasks():Promise<Task[]>{const {data,error}=await db().from('tasks').select('*,projects(name)').order('created_at',{ascending:false});fail(error);return data as Task[]}
export async function createTask(input:Partial<Task>){const {data:{user}}=await db().auth.getUser();const {data,error}=await db().from('tasks').insert({title:input.title,project_id:input.project_id||null,description:input.description||null,status:'A_FAIRE',priority:input.priority||'NORMALE',due_at:input.due_at||null,creator_id:user?.id}).select().single();fail(error);return data as Task}
export async function listInvoices():Promise<Invoice[]>{const {data,error}=await db().from('invoices').select('*,clients(name,email,address),projects(name),invoice_items(*),payments(*)').order('created_at',{ascending:false});fail(error);return data as Invoice[]}
export async function createInvoice(input:{client_id:string;project_id?:string;due_date:string;currency:string;discount:number;items:InvoiceItem[]}):Promise<Invoice>{const {data,error}=await db().rpc('create_invoice_with_items',{p_client_id:input.client_id,p_project_id:input.project_id||null,p_due_date:input.due_date,p_currency:input.currency,p_discount:input.discount,p_items:input.items});fail(error);const id=typeof data==='string'?data:(data as {id:string})?.id;const {data:invoice,error:readError}=await db().from('invoices').select('*,clients(name,email,address),projects(name),invoice_items(*),payments(*)').eq('id',id).single();fail(readError);return invoice as Invoice}
export async function listPayments():Promise<Payment[]>{const {data,error}=await db().from('payments').select('*,invoices(number,total,clients(name))').order('paid_at',{ascending:false});fail(error);return data as Payment[]}
export async function recordPayment(input:{invoice_id:string;amount:number;method:string;reference?:string}){const {data,error}=await db().rpc('record_invoice_payment',{p_invoice_id:input.invoice_id,p_amount:input.amount,p_method:input.method,p_reference:input.reference||null});fail(error);return data}
export async function listProfiles():Promise<Profile[]>{const {data,error}=await db().from('profiles').select('*').order('full_name');fail(error);return data as Profile[]}
