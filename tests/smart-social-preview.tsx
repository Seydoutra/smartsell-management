import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import SmartSocial from '../src/SmartSocial'
import { invoicePdfFile } from '../src/lib/invoicePdf'
import '../src/styles.css'
const all={view:true,create:true,update:true,delete:true},read={view:true,create:false,update:false,delete:false},none={view:false,create:false,update:false,delete:false}
function Preview(){
  const [reader,setReader]=useState(false),[connectionsOnly,setConnectionsOnly]=useState(false),[dark,setDark]=useState(false)
  return <div className="production-shell" style={{padding:'clamp(12px,3vw,40px)',maxWidth:1500,margin:'auto',minWidth:0}}>
    <div className="panel" style={{padding:14,marginBottom:24,display:'flex',flexWrap:'wrap',gap:14,alignItems:'center'}}><strong style={{fontSize:12}}>APERÇU LOCAL · DONNÉES FICTIVES · AUCUN ENVOI</strong><label><input type="checkbox" checked={reader} onChange={event=>setReader(event.target.checked)}/> Lecture seule</label><label><input type="checkbox" checked={connectionsOnly} onChange={event=>setConnectionsOnly(event.target.checked)}/> Connexions uniquement</label><button type="button" onClick={()=>{setDark(!dark);document.documentElement.dataset.theme=dark?'light':'dark'}}>Thème {dark?'clair':'sombre'}</button></div>
    <PdfCheck/>
    <SmartSocial key={`${reader}-${connectionsOnly}`} tenantOwnerId="11111111-1111-4111-8111-111111111111" editorialRights={connectionsOnly?none:reader?read:all} connectionRights={reader?read:all}/>
  </div>
}
function PdfCheck(){
  const ref=useRef<HTMLDivElement>(null),[state,setState]=useState(''),[busy,setBusy]=useState(false)
  return <details className="panel" style={{padding:16,marginBottom:20}}><summary>Test isolé du moteur PDF</summary>
    <div ref={ref} style={{background:'#fff',color:'#18171c',padding:32,maxWidth:650,margin:'20px 0'}}>
      <p style={{color:'#6f287e',fontWeight:700}}>SMARTSELL MANAGEMENT · DOCUMENT DE TEST</p><h2>Facture TEST-PDF-001</h2>
      <p>Client fictif · Aucune facture enregistrée dans la base</p><p>Prestation de test : 100 000 GNF</p>
      <p>Montant payé : 30 000 GNF</p><p><strong>Reste à payer : 70 000 GNF</strong></p><p style={{color:'#965000'}}>Partiellement payée</p>
      <p>Contrôle technique du téléchargement PDF. Ce document n’a aucune valeur commerciale.</p>
    </div>
    <button type="button" disabled={busy} onClick={async()=>{if(!ref.current)return;setBusy(true);setState('');try{const file=await invoicePdfFile(ref.current,'TEST-PDF-001'),url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setState(`PDF généré (${file.size} octets).`)}catch(cause){setState(cause instanceof Error?cause.message:'Échec')}finally{setBusy(false)}}}>Télécharger le PDF de test</button><p role="status">{state}</p>
  </details>
}
createRoot(document.getElementById('root')!).render(<Preview/> )
