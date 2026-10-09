import type { CreativeApproval, EditorialItem, SocialIntegration } from '../types/models'

export type SocialRights = { view:boolean; create:boolean; update:boolean; delete:boolean }
export type EditorialView = 'CALENDAR'|'TABLE'|'BOARD'|'REPORT'
export type SocialView = EditorialView|'CONNECTIONS'
export const editorialStatuses = ['A_REDIGER','EN_CREATION','A_VALIDER','VALIDE_CLIENT','PLANIFIE','PUBLIE','REPORTE'] as const
export const socialChannels = ['Instagram','Facebook','LinkedIn','TikTok','X / Twitter','YouTube','Site web']
export const socialProviders: {id:SocialIntegration['provider']; name:string}[] = [
  {id:'FACEBOOK',name:'Facebook'}, {id:'INSTAGRAM',name:'Instagram'}, {id:'LINKEDIN',name:'LinkedIn'},
  {id:'X',name:'X / Twitter'}, {id:'TIKTOK',name:'TikTok'}, {id:'YOUTUBE',name:'YouTube'},
]
export const socialViewLabels:Record<SocialView,string> = {
  CALENDAR:'Calendrier',TABLE:'Préparation',BOARD:'Validations',REPORT:'Rapports',CONNECTIONS:'Connexions',
}
export function allowedSocialViews(editorial:SocialRights,connections:SocialRights):SocialView[] {
  return [...(editorial.view ? ['CALENDAR','TABLE','BOARD','REPORT'] as const : []),...(connections.view ? ['CONNECTIONS'] as const : [])]
}
export function socialStatusLabel(status:string) {
  return ({A_REDIGER:'À rédiger',EN_CREATION:'En création',A_VALIDER:'À valider',VALIDE_CLIENT:'Validé par le client',PLANIFIE:'Planifié',PUBLIE:'Publié',REPORTE:'Reporté',NON_CONFIGURE:'Référence uniquement',CONNECTE:'Connecté',ERREUR:'Erreur de connexion'} as Record<string,string>)[status] || status.replaceAll('_',' ')
}
export function publishedLinks(item:EditorialItem):[string,string][] {
  const links=Object.entries(item.platform_links||{}).filter(([,url])=>isSafeWebUrl(url))
  if(item.published_url&&isSafeWebUrl(item.published_url)&&!links.some(([,url])=>url===item.published_url))links.push([item.platform||'Publication',item.published_url])
  return links
}
export function isSafeWebUrl(value:string) {
  try { const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password } catch{return false}
}
export function latestApproval(item:EditorialItem,approvals:CreativeApproval[]) {
  return approvals.filter(review=>review.editorial_item_id===item.id&&review.client_id===item.client_id)
    .sort((a,b)=>b.version-a.version || b.created_at.localeCompare(a.created_at))[0]
}
export function editorialContent(item:Partial<EditorialItem>) {
  return JSON.stringify({title:item.title||'',caption:item.caption||'',hashtags:item.hashtags||'',
    production_notes:item.production_notes||'',asset_urls:item.asset_urls||[],canva_design_id:item.canva_design_id||null,
    platforms:item.platforms?.length?item.platforms:[item.platform].filter(Boolean),content_type:item.content_type||'',
    visual_title:item.visual_title||'',visual_subtitle:item.visual_subtitle||'',objective:item.objective||''})
}
export function validateEditorialTransition(previous:EditorialItem|undefined,next:Partial<EditorialItem>,approvals:CreativeApproval[]) {
  if(!next.client_id||!['PLANIFIE','PUBLIE','VALIDE_CLIENT'].includes(next.status||''))return null
  if(!previous||previous.client_id!==next.client_id||editorialContent(previous)!==editorialContent(next))return 'Ce contenu a changé : enregistrez-le en création et demandez une nouvelle validation au client.'
  const review=latestApproval(previous,approvals)
  if(review?.status!=='APPROUVE')return 'Le client doit approuver la dernière version avant sa planification ou sa publication.'
  const snapshot=(review as CreativeApproval & {editorial_snapshot?:Partial<EditorialItem>|null}).editorial_snapshot
  if(snapshot!==undefined&&(!snapshot||editorialContent(snapshot)!==editorialContent(next)))return 'Le client doit approuver cette version exacte du contenu avant sa diffusion.'
  return null
}
export function metricValue(connection:SocialIntegration,key:string):number|null {
  if(connection.status!=='CONNECTE'||!connection.last_synced_at)return null
  const value=connection.metrics?.[key]
  return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null
}
export function validateTenantId(id:string) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('Espace Smart Social invalide. Reconnectez-vous.')
  return id
}
