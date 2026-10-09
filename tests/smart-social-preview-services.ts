// Local browser QA only. This file is never an entry of the production build.
// No Supabase client, credentials, storage, SMS or external provider calls.
import type { EditorialItem } from '../src/types/models'
const date=(day:number)=>new Date(new Date().getFullYear(),new Date().getMonth(),day,10,30).toISOString()
let items=['A_REDIGER','EN_CREATION','A_VALIDER','VALIDE_CLIENT','PLANIFIE','PUBLIE','REPORTE'].map((status,index)=>({id:`preview-${index}`,client_id:'client-a',project_id:null,title:['Le lancement de la campagne','Les coulisses de notre équipe','Un visuel à valider','Portrait de la semaine','Le conseil du mardi','Une publication réalisée','Le prochain rendez-vous'][index],caption:'Ce contenu est une fixture locale pour vérifier le calendrier et la lisibilité. Il n’appartient à aucun client réel.',platform:'Instagram',platforms:['Instagram','Facebook'],status,publish_at:date(4+index*3),asset_urls:[],created_at:new Date().toISOString()} as EditorialItem))
const clients=[{id:'client-a',name:'Client de test A'}]
export async function loadSocialEditorial(){return {items:items.map(item=>({...item,clients:{name:'Client de test A'}})),approvals:[],clients,projects:[]}}
export async function saveSocialEditorial(_tenant:string,input:Partial<EditorialItem>,id?:string){const item={...input,id:id||crypto.randomUUID(),created_at:new Date().toISOString()} as EditorialItem;items=id?items.map(old=>old.id===id?item:old):[...items,item];return item}
export async function deleteSocialEditorial(_tenant:string,id:string){items=items.filter(item=>item.id!==id)}
export async function importSocialEditorial(_tenant:string,rows:Partial<EditorialItem>[]){for(const row of rows)await saveSocialEditorial(_tenant,row);return rows.length}
export async function loadSocialConnections(){return {connections:[],clients}}
export async function saveSocialReference(){throw new Error('Références désactivées dans cet aperçu sans backend.')}
export async function deleteSocialReference(){throw new Error('Suppression de référence désactivée dans cet aperçu.')}
export async function createCreativeApproval(){throw new Error('Les envois au portail sont désactivés dans cet aperçu local.')}
export async function uploadEditorialAsset(){throw new Error('Téléversement désactivé dans cet aperçu.')}
export async function createEditorialItemsBatch(){throw new Error('Import non isolé interdit dans cet aperçu.')}
export async function canvaAction(){return {connected:false,configured:false,canManage:false,sharedConnected:false,accessGranted:false}}
