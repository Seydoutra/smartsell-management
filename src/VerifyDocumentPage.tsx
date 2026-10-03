import { useEffect, useState } from 'react'
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import { verifyCommercialDocument, type VerifiedCommercialDocument } from './services/repository'
import './verify-document.css'

export default function VerifyDocumentPage(){
  const token=new URLSearchParams(location.hash.split('?')[1]||'').get('token')||''
  const [result,setResult]=useState<VerifiedCommercialDocument|null>(null)
  const [error,setError]=useState('')
  useEffect(()=>{let active=true;verifyCommercialDocument(token).then(value=>{if(active)setResult(value)}).catch(()=>{if(active)setError('La vérification est momentanément indisponible. Réessayez plus tard.')});return()=>{active=false}},[token])
  return <main className="document-verify-page"><section className="document-verify-card"><div className="document-verify-icon"><ShieldCheck size={30}/></div><p className="eyebrow">SMARTSELL MANAGEMENT · VÉRIFICATION</p>
    {!result&&!error?<><h1>Vérification en cours…</h1><p>Nous interrogeons le registre des documents émis.</p></>:error?<><h1>Service indisponible</h1><p>{error}</p></>:result?.valid?<><CheckCircle2 className="verify-success" size={44}/><h1>{result.kind==='DEVIS'?'Ce devis':'Cette facture'} est conforme au registre</h1><p>Le document <strong>{result.number}</strong> est enregistré dans le registre de Smartsell Management.</p><dl><div><dt>Émetteur</dt><dd>{result.issuer}</dd></div><div><dt>Date d’émission</dt><dd>{result.issue_date?new Date(`${result.issue_date}T12:00:00`).toLocaleDateString('fr-FR'):'—'}</dd></div></dl><small>Cette vérification confirme l’existence de la référence, pas l’état du paiement ni l’absence de modifications sur une copie du PDF.</small></>:<><XCircle className="verify-failure" size={44}/><h1>Document non vérifiable</h1><p>Ce QR code ne correspond pas à une facture ou un devis actif dans notre registre. Contactez l’émetteur avant tout paiement.</p></>}
    <a href={import.meta.env.BASE_URL}>Retour à l’accueil</a></section></main>
}
