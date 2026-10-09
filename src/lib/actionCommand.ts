// Deliberately bounded, API-free command grammar. Never executes text or SQL.
export const commandKinds = ['CLIENT','TASK','PROJECT','FACTURE','DEVIS'] as const
export type CommandKind = typeof commandKinds[number]
export type CommandDraft = {
  kind:CommandKind; title:string; email:string; phone:string; description:string;
  clientName:string; projectName:string; assigneeName:string; date:string;
  service:string; amount:number|null; currency:string; taxRate:number;
}
export const commandLabels:Record<CommandKind,string>={CLIENT:'Client',TASK:'Tâche',PROJECT:'Projet',FACTURE:'Facture',DEVIS:'Devis'}
export const commandPermission=(kind:CommandKind)=>({CLIENT:'clients.create',TASK:'tasks.create',PROJECT:'projects.create',FACTURE:'invoices.create',DEVIS:'invoices.create'})[kind]
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
export function parseActionCommand(text:string):CommandDraft {
  const raw=text.trim()
  if(!raw||raw.length>2000)throw new Error('Saisissez une instruction de 1 à 2 000 caractères.')
  const words=normalize(raw)
  const head=words.match(/^(?:cree(?:r|z)?|ajoute(?:r|z)?)\s+(?:(?:un|une|le|la)\s+)?(client|tache|projet|facture|devis)\b/)
  if(!head)throw new Error('Commencez par « Créer un client », « Créer une tâche », « Créer un projet », « Créer une facture » ou « Créer un devis ».')
  const kinds={client:'CLIENT',tache:'TASK',projet:'PROJECT',facture:'FACTURE',devis:'DEVIS'} as const
  const kind=kinds[head[1] as keyof typeof kinds]
  if(/\b(?:cree(?:r|z)?|ajoute(?:r|z)?)\s+(?:un|une)\s+(?:client|tache|projet|facture|devis)\b/.test(words.slice(head[0].length)))throw new Error('Préparez une seule création à la fois.')
  const rest=raw.slice(head[0].length).replace(/^\s*[:,-]?\s*/,'')
  // Explicit separators avoid silently cutting a title/description containing “client” or “projet”.
  const segments=rest.replace(/\s+virgule\s+/gi,', ').split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean)
  const draft:CommandDraft={kind,title:'',email:'',phone:'',description:'',clientName:'',projectName:'',assigneeName:'',date:'',service:'',amount:null,currency:'GNF',taxRate:0}
  for(const segment of segments){
    const normalized=normalize(segment)
    const take=(prefix:RegExp)=>segment.slice(normalized.match(prefix)?.[0].length||0).trim().replace(/^[:=]\s*/,'')
    if(/^(?:e-?mail|courriel)\b/.test(normalized))draft.email=take(/^(?:e-?mail|courriel)\s*/)
    else if(/^(?:telephone|tel)\b/.test(normalized))draft.phone=take(/^(?:telephone|tel)\s*/)
    else if(/^description\b/.test(normalized))draft.description=take(/^description\s*/)
    else if(/^(?:pour\s+(?:le\s+)?client|client)\b/.test(normalized))draft.clientName=take(/^(?:pour\s+(?:le\s+)?client|client)\s*/)
    else if(/^(?:dans\s+(?:le\s+)?projet|projet)\b/.test(normalized))draft.projectName=take(/^(?:dans\s+(?:le\s+)?projet|projet)\s*/)
    else if(/^(?:attribue(?:r)?\s+a|assigne(?:r)?\s+a)\b/.test(normalized))draft.assigneeName=take(/^(?:attribue(?:r)?\s+a|assigne(?:r)?\s+a)\s*/)
    else if(/^(?:service|prestation)\b/.test(normalized))draft.service=take(/^(?:service|prestation)\s*/)
    else if(/^(?:date|echeance)\b/.test(normalized))draft.date=take(/^(?:date|echeance)\s*/)
    else if(/^(?:montant|prix)\b/.test(normalized)){
      const value=take(/^(?:montant|prix)\s*/).match(/^([\d\s\u00a0]+(?:\.\d{1,2})?)\s*(GNF|EUR|USD)?\s*$/i)
      if(!value)throw new Error('Indiquez le montant en chiffres, par exemple « montant 700000 GNF ».')
      draft.amount=Number(value[1].replace(/\s/g,''));draft.currency=value[2]?.toUpperCase()||'GNF'
      if(!Number.isFinite(draft.amount)||draft.amount>Number.MAX_SAFE_INTEGER)throw new Error('Montant trop élevé ou invalide.')
    }else if(/^sans tva$/.test(normalized))draft.taxRate=0
    else if(/^tva\b/.test(normalized)){
      const rate=normalized.match(/^tva\s+(\d{1,3}(?:\.\d+)?)\s*%?$/)
      if(!rate)throw new Error('Indiquez la TVA en chiffres, par exemple « TVA 18 % ».')
      draft.taxRate=Number(rate[1])
      if(draft.taxRate>100)throw new Error('La TVA doit être comprise entre 0 et 100 %.')
    }else if(!draft.title&&['CLIENT','TASK','PROJECT'].includes(kind)){
      if(/\s+(?:e-?mail|courriel|telephone|tel|montant|attribue(?:r)?\s+a|assigne(?:r)?\s+a)\b/.test(normalized))throw new Error('Séparez les informations par une virgule ; vous pouvez aussi dire « virgule ».')
      draft.title=segment.replace(/^(?:nom(?:me)?|titre)\s*:?\s*/i,'')
    }
    else throw new Error(`Champ non reconnu : « ${segment} ». Séparez les informations par des virgules et utilisez les exemples.`)
  }
  if(['CLIENT','TASK','PROJECT'].includes(kind)&&!draft.title)throw new Error('Ajoutez le nom ou le titre après le type de création.')
  if(draft.title.length>200)throw new Error('Le nom ou le titre doit contenir au maximum 200 caractères.')
  const supported:Record<CommandKind,string[]>={CLIENT:['title','email','phone'],TASK:['title','description','projectName','assigneeName','date'],PROJECT:['title','description','clientName','assigneeName'],FACTURE:['clientName','service','amount','date','currency','taxRate'],DEVIS:['clientName','service','amount','date','currency','taxRate']}
  for(const [key,value] of Object.entries(draft)){
    if(key==='kind'||supported[kind].includes(key)||value===''||value===null||(key==='currency'&&value==='GNF')||(key==='taxRate'&&value===0))continue
    throw new Error(`Cette information n’est pas prise en charge pour une création de ${commandLabels[kind].toLowerCase()}. Consultez les exemples.`)
  }
  if(draft.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)||!Number.isFinite(Date.parse(draft.date))||new Date(draft.date).toISOString().slice(0,10)!==draft.date))throw new Error('Indiquez une date valide au format AAAA-MM-JJ, par exemple 2026-12-10.')
  return draft
}
// Never resolve a partial/ambiguous name to the first account in a list.
export function exactCommandMatch<T extends {id:string}>(name:string,rows:T[],label:(row:T)=>string):string {
  if(!name.trim())return ''
  const matches=rows.filter(row=>normalize(label(row))===normalize(name))
  return matches.length===1?matches[0].id:''
}
