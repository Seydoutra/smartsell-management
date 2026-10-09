import type { EditorialItem } from '../types/models'
export const socialNetworks=['FACEBOOK','INSTAGRAM','LINKEDIN','TIKTOK','YOUTUBE','X'] as const
export const socialMeasures=[['followers','Abonnés'],['likes','Likes'],['shares','Partages'],['reach','Portée'],['impressions','Impressions'],['engagements','Interactions']] as const
export type SocialMeasurement={id:string;client_id:string;network:string;account_key:string;kind:'BASELINE'|'SNAPSHOT';measured_on:string;followers:number|null;likes:number|null;shares:number|null;reach:number|null;impressions:number|null;engagements:number|null;notes:string|null}
export type MonthlyCommitment={id:string;month:string;publications:number;videos:number;reels:number;notes:string|null}
export type ContractCommitment={id:string;effective_month:string;publications:number;videos:number;reels:number;notes:string|null}
export type Delivered={publications:number;videos:number;reels:number}
export type MonthlyReport={id:string;month:string;generated_at:string;payload:{client_name:string;month:string;commitments:Omit<MonthlyCommitment,'id'|'month'>|null;delivered:Delivered;social:Array<{network:string;account_key:string;baseline:SocialMeasurement;latest:SocialMeasurement|null}>;method:string}}
export const validMonth=(value:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value)
export function monthlyDeliveries(items:EditorialItem[],month:string):Delivered {
  const count:Delivered={publications:0,videos:0,reels:0}
  if(!validMonth(month))return count
  const seen=new Set<string>()
  for(const item of items){
    if(seen.has(item.id)||item.status!=='PUBLIE'||!item.publish_at||!Number.isFinite(Date.parse(item.publish_at))||new Date(item.publish_at).toISOString().slice(0,7)!==month)continue
    seen.add(item.id)
    const format=(item.content_type?.trim()||item.post_type||'').toUpperCase()
    if(format.includes('REEL'))count.reels++;else if(/VID[EÉ]O/.test(format))count.videos++;else count.publications++
  }
  return count
}
export function compareSocialMeasurements(measurements:SocialMeasurement[],month:string):Array<{baseline:SocialMeasurement;latest:SocialMeasurement|null}> {
  return measurements.filter(row=>row.kind==='BASELINE'&&row.measured_on.slice(0,7)<=month).map(baseline=>({baseline,
    latest:measurements.filter(row=>row.kind==='SNAPSHOT'&&row.network===baseline.network&&row.account_key===baseline.account_key&&row.measured_on.slice(0,7)===month&&row.measured_on>=baseline.measured_on).sort((a,b)=>b.measured_on.localeCompare(a.measured_on))[0]||null,
  }))
}
export function achievement(actual:number,target:number|undefined) {return target===undefined||target===0?null:Math.round(actual/target*100)}
export function effectiveCommitment(month:string,contracts:ContractCommitment[],overrides:MonthlyCommitment[]) {
  return overrides.find(row=>row.month.slice(0,7)===month)||contracts.filter(row=>row.effective_month.slice(0,7)<=month).sort((a,b)=>b.effective_month.localeCompare(a.effective_month))[0]
}
export function interpretClientResults(delivered:Delivered,target:Pick<MonthlyCommitment,'publications'|'videos'|'reels'>|undefined,comparisons:ReturnType<typeof compareSocialMeasurements>) {
  const insights:string[]=[]
  if(!target)insights.push('Les engagements contractuels doivent être renseignés avant d’évaluer leur atteinte.')
  else {
    const gaps=([['publications','publication(s)'],['videos','vidéo(s)'],['reels','reel(s)']] as const).filter(([key])=>delivered[key]<target[key]).map(([key,label])=>`${target[key]-delivered[key]} ${label}`)
    insights.push(gaps.length?`Écart aux engagements : ${gaps.join(', ')} restent à livrer sur la période.`:'Tous les volumes contractuels renseignés sont atteints sur cette période.')
  }
  if(!comparisons.length)insights.push('Enregistrez la situation de départ pour mesurer l’évolution sociale du client.')
  for(const {baseline,latest} of comparisons){
    if(!latest){insights.push(`${baseline.network} : aucun relevé du mois, évolution non évaluable.`);continue}
    if(baseline.followers!==null&&latest.followers!==null){const growth=latest.followers-baseline.followers;insights.push(`${baseline.network} · ${baseline.account_key} : ${growth>0?'+':''}${growth} abonné(s) depuis le démarrage.${growth<0?' Examiner les contenus et le ciblage.':''}`)}
    else insights.push(`${baseline.network} : nombre d’abonnés incomplet, évolution non évaluable.`)
  }
  insights.push('Les volumes livrés et la croissance sociale sont deux indicateurs distincts. Une évolution ne prouve pas à elle seule l’effet du service ; comparez aussi la qualité des interactions et les conversions.')
  return insights
}
