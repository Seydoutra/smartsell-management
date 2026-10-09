import { describe, expect, it } from 'vitest'
import { achievement, compareSocialMeasurements, effectiveCommitment, interpretClientResults, monthlyDeliveries, type ContractCommitment, type MonthlyCommitment, type SocialMeasurement } from './clientSocialReporting'
import type { EditorialItem } from '../types/models'
const item=(id:string,type:string,status='PUBLIE',date='2026-10-09T10:00:00Z')=>({id,content_type:type,status,publish_at:date,platforms:['Facebook','Instagram']}) as EditorialItem
const baseline={id:'b',kind:'BASELINE',network:'FACEBOOK',account_key:'client',measured_on:'2026-09-01',followers:100} as SocialMeasurement
describe('engagements contractuels et résultats clients',()=>{
  it('compte uniquement les contenus réellement publiés, sans doubler les réseaux ou cartes',()=>{
    expect(monthlyDeliveries([item('p','IMAGE'),item('p','IMAGE'),item('v','VIDÉO'),item('r','REEL'),item('pending','VIDEO','PLANIFIE'),item('old','IMAGE','PUBLIE','2026-09-01')],'2026-10')).toEqual({publications:1,videos:1,reels:1})
  })
  it('respecte le mois en UTC/Conakry, même avec un horodatage décalé',()=>expect(monthlyDeliveries([item('boundary','VIDEO','PUBLIE','2026-11-01T00:30:00+02:00')],'2026-10').videos).toBe(1))
  it('n’invente pas un taux pour un objectif absent ou nul',()=>{expect(achievement(4,undefined)).toBeNull();expect(achievement(4,0)).toBeNull();expect(achievement(4,8)).toBe(50)})
  it('réutilise le même contrat mois après mois et conserve l’ancien avant une révision',()=>{
    const initial={id:'1',effective_month:'2026-09-01',publications:12} as ContractCommitment,revised={id:'2',effective_month:'2026-12-01',publications:16} as ContractCommitment
    expect(effectiveCommitment('2026-10',[initial,revised],[])?.publications).toBe(12)
    expect(effectiveCommitment('2027-01',[initial,revised],[])?.publications).toBe(16)
    expect(effectiveCommitment('2026-08',[initial,revised],[])).toBeUndefined()
    expect(effectiveCommitment('2026-10',[initial,revised],[{month:'2026-10-01',publications:20} as MonthlyCommitment])?.publications).toBe(20)
  })
  it('compare uniquement la même page et le relevé de la période, sans inventer de zéro',()=>{
    const current={...baseline,id:'s',kind:'SNAPSHOT',measured_on:'2026-10-09',followers:120} as SocialMeasurement
    const rows=compareSocialMeasurements([baseline,current,{...current,id:'other',account_key:'autre-page',followers:999}],'2026-10')
    expect(rows[0].latest?.followers).toBe(120);expect(compareSocialMeasurements([baseline,current],'2026-11')[0].latest).toBeNull()
  })
  it('interprète séparément l’atteinte des livrables et l’évolution de la communauté',()=>{
    const results=interpretClientResults({publications:4,videos:1,reels:2},{publications:8,videos:1,reels:2},[{baseline,latest:{...baseline,followers:120}}])
    expect(results[0]).toMatch(/4 publication/);expect(results[1]).toMatch(/\+20 abonné/);expect(results[2]).toMatch(/ne prouve pas/)
  })
})
