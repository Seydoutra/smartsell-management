import { useState, type FormEvent } from 'react'
import { ArrowRight, CreditCard, Smartphone } from 'lucide-react'
import { createSubscriptionRequest } from './services/repository'
import './trial-paywall.css'

type Plan='ESSENTIEL'|'CROISSANCE'|'ENTREPRISE'
type Period='MONTHLY'|'ANNUAL'
const plans:Record<Plan,{name:string;monthly:number;annual:number;description:string}>={
  ESSENTIEL:{name:'Essentiel',monthly:300000,annual:3240000,description:'Pour structurer votre activité.'},
  CROISSANCE:{name:'Croissance',monthly:700000,annual:7560000,description:'Pour coordonner une équipe active.'},
  ENTREPRISE:{name:'Entreprise',monthly:1000000,annual:10800000,description:'Pour déployer à grande échelle.'},
}
const money=(value:number)=>`${new Intl.NumberFormat('fr-FR').format(value)} GNF`

export default function SubscriptionPage(){
  const[plan,setPlan]=useState<Plan>('ESSENTIEL'),[period,setPeriod]=useState<Period>('MONTHLY')
  const[method,setMethod]=useState<'ORANGE_MONEY'|'MOBILE_MONEY'>('ORANGE_MONEY')
  const[phone,setPhone]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const amount=period==='MONTHLY'?plans[plan].monthly:plans[plan].annual
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(busy)return
    setBusy(true);setError('');setNotice('')
    try{
      const result=await createSubscriptionRequest({plan,billing_period:period,payment_method:method,phone})
      setNotice(`Demande n° ${result.id.slice(0,8)} enregistrée pour ${money(result.amount_gnf)}${result.discount_gnf?` après une réduction de ${money(result.discount_gnf)}`:''}. Aucun paiement n’a été prélevé. L’abonnement ne sera activé qu’après paiement confirmé.`)
    }catch(cause){setError(cause instanceof Error?cause.message:'Impossible d’enregistrer la demande.')}
    finally{setBusy(false)}
  }
  return <div className="subscription-page">
    <header className="subscription-hero"><span><CreditCard/> ABONNEMENT & PAIEMENT</span><h1>Choisissez votre prochaine étape.</h1><p>Comparez les formules et préparez votre activation en toute transparence.</p></header>
    <form className="trial-paywall subscription-checkout" onSubmit={submit}>
      <fieldset className="trial-plan-choices"><legend>Votre formule</legend>{(Object.keys(plans) as Plan[]).map(key=><label key={key} className={plan===key?'selected':''}><input type="radio" name="plan" value={key} checked={plan===key} onChange={()=>setPlan(key)}/><span><strong>{plans[key].name}</strong><small>{plans[key].description}<br/>{money(period==='MONTHLY'?plans[key].monthly:plans[key].annual)} / {period==='MONTHLY'?'mois':'an'}</small></span></label>)}</fieldset>
      <div className="trial-period"><button type="button" className={period==='MONTHLY'?'selected':''} onClick={()=>setPeriod('MONTHLY')}>Mensuel</button><button type="button" className={period==='ANNUAL'?'selected':''} onClick={()=>setPeriod('ANNUAL')}>Annuel · −10 %</button></div>
      <fieldset className="trial-method-choices"><legend>Moyen de paiement souhaité</legend><label><input type="radio" name="method" checked={method==='ORANGE_MONEY'} onChange={()=>setMethod('ORANGE_MONEY')}/> Orange Money</label><label><input type="radio" name="method" checked={method==='MOBILE_MONEY'} onChange={()=>setMethod('MOBILE_MONEY')}/> Mobile Money</label></fieldset>
      <label className="trial-phone"><Smartphone/> Numéro mobile<input type="tel" inputMode="tel" required minLength={8} maxLength={20} value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+224 620 00 00 00"/></label>
      <div className="trial-paywall-total"><span>Total indicatif</span><strong>{money(amount)} / {period==='MONTHLY'?'mois':'an'}</strong></div>
      <p className="trial-payment-disclaimer">Orange Money et Mobile Money sont affichés pour préparer votre choix. Leur passerelle de paiement n’est pas encore connectée : cette étape enregistre une demande, ne débite pas votre compte et n’active pas l’abonnement. Les avantages de parrainage ne s’appliquent qu’après un paiement vérifié.</p>
      {error&&<p className="trial-paywall-error" role="alert">{error}</p>}{notice&&<p className="trial-paywall-success" role="status">{notice}</p>}
      <button className="trial-paywall-submit" type="submit" disabled={busy}>{busy?'Enregistrement…':'Enregistrer ma demande'}<ArrowRight/></button>
    </form>
  </div>
}
