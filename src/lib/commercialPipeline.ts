import type { Prospect, Service } from '../types/models'

export const commercialStages = [
  ['NOUVEAU','Nouveau'], ['CONTACTE','Contacté'], ['QUALIFIE','Qualifié'],
  ['PROPOSITION','Proposition'], ['NEGOCIATION','Négociation'], ['GAGNE','Gagné'], ['PERDU','Perdu'],
] as const
export const isOpenProspect = (p: Prospect) => !['GAGNE','PERDU'].includes(p.stage)
const timestamp = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null
export function prospectPriority(p: Prospect, now = Date.now()) {
  if (!isOpenProspect(p)) return {score:0, reason:'Opportunité clôturée', action:'Consulter le bilan'}
  const followUp=timestamp(p.next_follow_up_at), lastContact=timestamp(p.last_contact_at)
  const reachable=Boolean(p.phone?.trim() || p.email?.trim() || p.whatsapp?.trim())
  let score=({NOUVEAU:15,CONTACTE:25,QUALIFIE:35,PROPOSITION:45,NEGOCIATION:55} as Record<string,number>)[p.stage] || 10
  const reasons:string[]=[]
  if(followUp!==null && followUp<=now){score+=35;reasons.push('Relance arrivée à échéance')}
  else if(followUp!==null && followUp<=now+86_400_000){score+=15;reasons.push('Relance dans les prochaines 24 h')}
  if(lastContact!==null && now-lastContact>=14*86_400_000){score+=10;reasons.push('Aucun contact enregistré depuis 14 jours')}
  if(!reachable) reasons.push('Coordonnées à compléter')
  if(!reasons.length) reasons.push(`Étape : ${commercialStages.find(([stage])=>stage===p.stage)?.[1] || p.stage}`)
  const action=!reachable?'Compléter les coordonnées':followUp!==null && followUp<=now?'Contacter le prospect et enregistrer la prochaine relance':
    ({NOUVEAU:'Qualifier le besoin et identifier le décideur',CONTACTE:'Confirmer le besoin, le budget et le calendrier',QUALIFIE:'Préparer une offre adaptée au besoin',PROPOSITION:'Vérifier la réception de l’offre et traiter les objections',NEGOCIATION:'Clarifier les derniers points et convenir d’une décision'} as Record<string,string>)[p.stage] || 'Planifier la prochaine action'
  return {score:Math.min(100,reachable?score:Math.min(score,25)),reason:reasons.join(' · '),action}
}
export function rankedProspects(rows:Prospect[], now=Date.now()) {
  return rows.filter(isOpenProspect).map(prospect=>({prospect,...prospectPriority(prospect,now)}))
    .sort((a,b)=>b.score-a.score || a.prospect.company.localeCompare(b.prospect.company,'fr'))
}
const tokens=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/[^a-z0-9]+/).filter(word=>word.length>2 && !['pour','avec','dans','les','des','une','sur','notre','votre','service','creation','gestion'].includes(word))
export function offerFocus(prospects:Prospect[], services:Service[], now=Date.now()) {
  return services.filter(service=>service.active).map(service=>{
    const keywords=new Set(tokens([service.name,service.category,service.description].filter(Boolean).join(' ')))
    const matches=prospects.filter(p=>isOpenProspect(p) && tokens(p.need||'').some(word=>keywords.has(word)))
    return {service,prospects:matches,overdue:matches.filter(p=>{const date=timestamp(p.next_follow_up_at);return date!==null&&date<=now}).length}
  }).filter(row=>row.prospects.length).sort((a,b)=>b.overdue-a.overdue || b.prospects.length-a.prospects.length || a.service.name.localeCompare(b.service.name,'fr'))
}

export type ModuleIntent={view?:string;action?:string;request?:string}
export function readModuleIntent(query:string):ModuleIntent {
  const params=new URLSearchParams(query)
  return {view:params.get('view')||undefined,action:params.get('action')||undefined,request:params.get('request')||undefined}
}
export function moduleNavigationHash(page:string,clientId:string|null=null,intent:ModuleIntent={}) {
  const params=new URLSearchParams()
  if(clientId)params.set('client',clientId)
  if(intent.view)params.set('view',intent.view)
  if(intent.action)params.set('action',intent.action)
  if(intent.request)params.set('request',intent.request)
  return `#/${encodeURIComponent(page)}${params.size?`?${params}`:''}`
}
