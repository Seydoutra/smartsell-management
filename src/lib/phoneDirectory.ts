import { normalizePhone } from './contactImport'
export type PhoneContact={name:string;phone:string}
export type ContactsManager={select:(properties:string[],options:{multiple:boolean})=>Promise<Array<{name?:string[];tel?:string[]}>>}
export function selectedPhoneContacts(rows:Array<{name?:string[];tel?:string[]}>):PhoneContact[] {
  const seen=new Set<string>()
  return rows.flatMap(row=>(row.tel||[]).map(value=>({name:row.name?.[0]||'Contact',phone:normalizePhone(value)})))
    .filter(row=>Boolean(row.phone)&&!seen.has(row.phone)&&Boolean(seen.add(row.phone)))
}
export function mergePhoneRecipients(previous:string,contacts:PhoneContact[]) {
  const existing=previous.split(/[;,\n]/).map(normalizePhone).filter(Boolean)
  return [...new Set([...existing,...contacts.map(row=>normalizePhone(row.phone)).filter(Boolean)])].join('\n')
}
export function contactsFromVCard(text:string):PhoneContact[] {
  const unfolded=text.replace(/\r?\n[ \t]/g,'')
  return selectedPhoneContacts(unfolded.split(/BEGIN:VCARD/i).slice(1).map(card=>({
    name:[card.match(/^FN(?:;[^:]*)?:(.*)$/mi)?.[1]?.trim().replace(/\\n/g,' ').replace(/\\([,;\\])/g,'$1')||'Contact'],
    tel:[...card.matchAll(/^TEL(?:;[^:]*)?:(.*)$/gmi)].map(match=>match[1].trim().replace(/^tel:/i,'')),
  })))
}
