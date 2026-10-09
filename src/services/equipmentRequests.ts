import {supabase} from './supabase'
export type EquipmentRequestItem={id:string;equipment_id:string;equipment_name:string;equipment_code:string;condition_out:string|null;condition_out_photos:string[];condition_in:string|null;condition_in_photos:string[];return_condition:string|null;returned_at:string|null}
export type EquipmentRequest={id:string;requested_by:string|null;requester_name:string;reason:string;destination:string;expected_return_at:string;status:string;decision_name:string|null;decision_notes:string|null;decision_at:string|null;checked_out_at:string|null;created_at:string;items:EquipmentRequestItem[]}
export type EquipmentWorkspace={can_review:boolean;can_configure:boolean;can_request:boolean;reviewer_id:string|null;reviewer_name:string|null;staff:{id:string;name:string}[];equipment:{id:string;code:string;name:string;condition:string|null;available:boolean}[];requests:EquipmentRequest[]}
const db=()=>{if(!supabase)throw new Error('Supabase non configuré');return supabase}
async function rpc<T>(name:string,args?:Record<string,unknown>):Promise<T>{const {data,error}=await db().rpc(name,args);if(error)throw new Error(error.message);return data as T}
export const loadEquipmentWorkspace=()=>rpc<EquipmentWorkspace>('equipment_request_workspace')
export const configureEquipmentReviewer=(id:string|null)=>rpc<void>('configure_equipment_reviewer',{p_reviewer:id})
export const submitEquipmentRequest=(input:{reason:string;destination:string;returnAt:string;equipment:string[]})=>rpc<string>('submit_equipment_request',{p_reason:input.reason,p_destination:input.destination,p_return_at:input.returnAt,p_equipment:input.equipment})
export const decideEquipmentRequest=(id:string,approve:boolean,notes:string)=>rpc<void>('decide_equipment_request',{p_request:id,p_approve:approve,p_notes:notes})
export type EquipmentEvidence={equipment_id:string;notes:string;photos:string[];condition?:string}
export const checkoutEquipmentRequest=(id:string,items:EquipmentEvidence[])=>rpc<void>('checkout_equipment_request',{p_request:id,p_items:items})
export const returnEquipmentRequest=(id:string,items:EquipmentEvidence[])=>rpc<void>('return_equipment_request',{p_request:id,p_items:items})
export function validateEquipmentPhoto(file:File){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Photo JPG, PNG ou WebP requise.');
 if(file.size===0||file.size>5*1024*1024)throw new Error('Chaque photo doit peser au maximum 5 Mo.');
}
export async function uploadEquipmentPhoto(tenant:string,request:string,equipment:string,stage:'OUT'|'IN',file:File){
 validateEquipmentPhoto(file);
 const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
 const path=`${tenant}/${request}/${equipment}/${stage}/${crypto.randomUUID()}.${ext}`;
 const {error}=await db().storage.from('equipment-evidence').upload(path,file,{contentType:file.type,upsert:false});
 if(error)throw new Error(error.message);return path;
}
export async function getEquipmentPhotoUrl(path:string){const {data,error}=await db().storage.from('equipment-evidence').createSignedUrl(path,120);if(error)throw new Error(error.message);return data.signedUrl}
export async function discardEquipmentPhotos(paths:string[]){if(!paths.length)return;const {error}=await db().storage.from('equipment-evidence').remove(paths);if(error)throw new Error(error.message)}
