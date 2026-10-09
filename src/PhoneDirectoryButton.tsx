import { useRef, useState } from 'react'
import { ContactRound, Upload } from 'lucide-react'
import { contactsFromVCard, selectedPhoneContacts, type ContactsManager, type PhoneContact } from './lib/phoneDirectory'
import './phone-directory.css'

export default function PhoneDirectoryButton({onSelected}:{onSelected:(contacts:PhoneContact[])=>void}) {
  const [busy,setBusy]=useState(false),[help,setHelp]=useState(false),[notice,setNotice]=useState(''),[imported,setImported]=useState<PhoneContact[]>([]),[checked,setChecked]=useState<string[]>([])
  const busyRef=useRef(false)
  const contacts=(navigator as Navigator&{contacts?:ContactsManager}).contacts
  const available=window.isSecureContext&&Boolean(contacts?.select)
  const choose=async()=>{
    if(busyRef.current)return
    setNotice('')
    if(!available||!contacts){setHelp(value=>!value);return}
    busyRef.current=true;setBusy(true)
    try{
      // Call immediately from the click: awaiting anything first can lose user activation.
      const selected=selectedPhoneContacts(await contacts.select(['name','tel'],{multiple:true}))
      if(selected.length){onSelected(selected);setNotice(`${selected.length} numéro(s) ajouté(s).`)}else setNotice('Aucun numéro sélectionné.')
    }catch(cause){if(cause instanceof DOMException&&cause.name==='AbortError')setNotice('Sélection annulée.');else{setHelp(true);setNotice('Impossible d’ouvrir Contacts. Vous pouvez importer un contact ci-dessous.')}}
    finally{busyRef.current=false;setBusy(false)}
  }
  return <div className="phone-directory">
    <button type="button" className="phone-directory-button" onClick={()=>void choose()} disabled={busy} aria-label="Ouvrir le répertoire du téléphone"><ContactRound size={18}/>{busy?'Ouverture…':'Répertoire'}</button>
    {notice&&<small role="status">{notice}</small>}
    {help&&<div className="phone-directory-help"><p>Ce navigateur ne permet pas l’accès direct aux contacts du téléphone. Sur Chrome Android compatible, le bouton ouvre le sélecteur natif. Sur iPhone, exportez un contact depuis Contacts en fichier .vcf, puis importez-le ici, ou saisissez son numéro.</p><label className="phone-directory-import"><Upload size={16}/>Importer un contact (.vcf)<input type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={async event=>{
      const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return
      try{if(file.size>2_000_000)throw new Error('Fichier trop volumineux (2 Mo maximum).');const rows=contactsFromVCard(await file.text());setImported(rows);setChecked([]);setNotice(rows.length?'Sélectionnez les numéros à ajouter.':'Ce fichier ne contient aucun numéro.')}catch(cause){setNotice(cause instanceof Error?cause.message:'Import impossible.')}
    }}/></label>{imported.length>0&&<div className="phone-directory-selection">{imported.map(row=><label key={row.phone}><input type="checkbox" checked={checked.includes(row.phone)} onChange={event=>setChecked(current=>event.target.checked?[...current,row.phone]:current.filter(phone=>phone!==row.phone))}/><span>{row.name}<small>{row.phone}</small></span></label>)}<button type="button" disabled={!checked.length} onClick={()=>{const rows=imported.filter(row=>checked.includes(row.phone));onSelected(rows);setImported([]);setChecked([]);setHelp(false);setNotice(`${rows.length} numéro(s) ajouté(s).`)}}>Ajouter les contacts sélectionnés</button></div>}</div>}
  </div>
}
