import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole, Smartphone, X } from 'lucide-react'
import { createSubscriptionRequest } from './services/repository'
import './trial-paywall.css'

type Plan = 'ESSENTIEL'|'CROISSANCE'|'ENTREPRISE'
type Period = 'MONTHLY'|'ANNUAL'
const plans:Record<Plan,{name:string;monthly:number;annual:number}> = {
  ESSENTIEL:{name:'Essentiel',monthly:300000,annual:3240000},
  CROISSANCE:{name:'Croissance',monthly:700000,annual:7560000},
  ENTREPRISE:{name:'Entreprise',monthly:1000000,annual:10800000},
}
const money=(value:number)=>new Intl.NumberFormat('fr-FR').format(value)+' GNF'

export default function TrialPaywall({open,onClose,expiredAt,canRequest}:{open:boolean;onClose:()=>void;expiredAt:string;canRequest:boolean}){
  const [plan,setPlan]=useState<Plan>('ESSENTIEL')
  const [period,setPeriod]=useState<Period>('MONTHLY')
  const [method,setMethod]=useState<'ORANGE_MONEY'|'MOBILE_MONEY'>('ORANGE_MONEY')
  const [phone,setPhone]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  if(!open)return null
  const amount=period==='MONTHLY'?plans[plan].monthly:plans[plan].annual
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    if(busy)return
    setError('');setNotice('');setBusy(true)
    try{
      const result=await createSubscriptionRequest({plan,billing_period:period,payment_method:method,phone})
      setNotice(`Demande enregistrée pour ${money(result.amount_gnf)}${result.discount_gnf?` (réduction de parrainage : ${money(result.discount_gnf)})`:''}. Aucun paiement n’a été prélevé : le paiement mobile sera disponible après connexion du fournisseur. L’avantage ne sera acquis qu’après paiement confirmé.`)
    }catch(cause){setError(cause instanceof Error?cause.message:'Enregistrement impossible. Réessayez.')}
    finally{setBusy(false)}
  }
  return <div className="trial-paywall-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="trial-paywall" role="dialog" aria-modal="true" aria-labelledby="trial-paywall-title">
      <button type="button" className="trial-paywall-close" onClick={onClose} aria-label="Fermer"><X/></button>
      <div className="trial-paywall-kicker"><LockKeyhole/> ESPACE EN LECTURE SEULE</div>
      <h2 id="trial-paywall-title">Votre essai est terminé.</h2>
      <p>Votre espace et vos données restent visibles. Les modifications et les envois sont suspendus depuis le {new Date(expiredAt).toLocaleDateString('fr-FR')}. Choisissez une formule pour demander l’activation.</p>
      {!canRequest&&<p className="trial-paywall-error">Seul le responsable de cet espace peut demander un abonnement. Contactez-le pour réactiver les fonctionnalités.</p>}
      {canRequest&&
      <form onSubmit={submit}>
        <fieldset className="trial-plan-choices"><legend>Choisir une formule</legend>{(Object.keys(plans) as Plan[]).map(key=><label key={key} className={plan===key?'selected':''}><input type="radio" name="plan" value={key} checked={plan===key} onChange={()=>setPlan(key)}/><span><strong>{plans[key].name}</strong><small>{money(period==='MONTHLY'?plans[key].monthly:plans[key].annual)} / {period==='MONTHLY'?'mois':'an'}</small></span></label>)}</fieldset>
        <div className="trial-period"><button type="button" className={period==='MONTHLY'?'selected':''} onClick={()=>setPeriod('MONTHLY')}>Mensuel</button><button type="button" className={period==='ANNUAL'?'selected':''} onClick={()=>setPeriod('ANNUAL')}>Annuel · −10 %</button></div>
        <fieldset className="trial-method-choices"><legend>Moyen de paiement souhaité</legend><label><input type="radio" name="method" checked={method==='ORANGE_MONEY'} onChange={()=>setMethod('ORANGE_MONEY')}/>Orange Money</label><label><input type="radio" name="method" checked={method==='MOBILE_MONEY'} onChange={()=>setMethod('MOBILE_MONEY')}/>Mobile Money</label></fieldset>
        <label className="trial-phone"><Smartphone/> Numéro pour vous recontacter<input type="tel" inputMode="tel" required minLength={8} maxLength={20} value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+224 620 00 00 00"/></label>
        <div className="trial-paywall-total"><span>Formule choisie</span><strong>{money(amount)} / {period==='MONTHLY'?'mois':'an'}</strong></div>
        <p className="trial-payment-disclaimer">Le paiement en ligne n’est pas encore activé. Ce formulaire enregistre une demande ; il ne débite pas votre compte et ne renouvelle pas l’accès automatiquement.</p>
        {error&&<p className="trial-paywall-error" role="alert">{error}</p>}{notice&&<p className="trial-paywall-success" role="status">{notice}</p>}
        <button type="submit" className="trial-paywall-submit" disabled={busy}>{busy?'Enregistrement…':'Demander l’activation'} <ArrowRight/></button>
      </form>}
    </section>
  </div>
}
