import { useEffect, useState } from 'react'
import { Check, Copy, Gift, Link2, Users } from 'lucide-react'
import { getOrCreateReferralCode, getReferralSummary } from './services/repository'
import './referral.css'

type Summary={code:string;signups:number;converted:number;credits_available:number;credits_redeemed:number}
export default function ReferralDashboard(){
  const [summary,setSummary]=useState<Summary|null>(null)
  const [error,setError]=useState('')
  const [copied,setCopied]=useState(false)
  useEffect(()=>{let live=true;void (async()=>{try{await getOrCreateReferralCode();const result=await getReferralSummary();if(live)setSummary(result as Summary)}catch(cause){if(live)setError(cause instanceof Error?cause.message:'Parrainage indisponible')}})();return()=>{live=false}},[])
  const link=summary?.code?`${location.origin}${import.meta.env.BASE_URL}#signup?ref=${summary.code}`:''
  const copy=async()=>{if(!link)return;try{await navigator.clipboard.writeText(link);setCopied(true);window.setTimeout(()=>setCopied(false),2500)}catch{setError('Copie indisponible. Sélectionnez le lien et copiez-le manuellement.')}}
  return <section className="referral-dashboard">
    <span className="eyebrow"><Gift/> PROGRAMME DE PARRAINAGE</span><h2>Grandissons ensemble.</h2><p>Partagez votre lien avec une entreprise. Elle reçoit 10 % sur son premier paiement mensuel, et vous un crédit de 10 % sur votre prochaine mensualité une fois ce paiement confirmé.</p>
    {error&&<p role="alert" className="referral-error">{error}</p>}
    <div className="referral-metrics"><article><Users/><strong>{summary?.signups??'—'}</strong><span>Inscriptions parrainées</span></article><article><Check/><strong>{summary?.converted??'—'}</strong><span>Premiers paiements confirmés</span></article><article><Gift/><strong>{summary?.credits_available??'—'}</strong><span>Crédits disponibles</span></article><article><Check/><strong>{summary?.credits_redeemed??'—'}</strong><span>Crédits utilisés</span></article></div>
    <div className="referral-share"><Link2/><div><strong>Votre lien personnel</strong><input readOnly value={link} aria-label="Lien de parrainage" onFocus={event=>event.target.select()} placeholder="Chargement…"/></div><button onClick={copy} disabled={!link}><Copy/> {copied?'Copié !':'Copier le lien'}</button></div>
    <p className="referral-disclaimer">Le suivi des inscriptions est actif. Aucun avantage n’est acquis avant un paiement vérifié. Les paiements Orange Money et Mobile Money ne sont pas encore connectés ; aucune demande ne déclenche automatiquement un crédit.</p>
  </section>
}
