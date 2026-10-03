import { parseCsvRows } from './contactImport'

export type EditorialImportRow = {
  line: number; sheet: string; title: string; publish_at: string; platforms: string[];
  content_type: string; caption: string; client: string; project: string;
  theme: string; post_type: string; objective: string; visual_title: string;
  visual_subtitle: string; hashtags: string; production_notes: string; week_label: string;
  status: string; error: string | null
}

const key = (value: unknown) => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const clean = (value: unknown) => String(value ?? '').trim()
const aliases = {
  title: ['titre','title','publication','post','nom','titreinfographietextesurvisuel'],
  date: ['date','datepublication','publishdate','scheduledate'],
  time: ['heure','time','heurepublication'],
  platforms: ['reseaux','reseau','reseausocial','plateformes','plateforme','platforms','platform','socialnetworks'],
  content_type: ['format','typecontenu','contenttype'],
  caption: ['legende','texte','contenu','caption','message','textedepublication'],
  client: ['client','customer'], project: ['projet','project'], status: ['statut','status','etat'],
  theme: ['poletheme','theme','pole'], post_type: ['type','typedepost'],
  objective: ['objectifdupost','objectif'], visual_title: ['titreinfographietextesurvisuel','titrevisuel'],
  visual_subtitle: ['soustitredetailsinfographie','soustitredetails','soustitre'],
  hashtags: ['hashtagsoptimises','hashtags'], production_notes: ['pourmiseajour','notesproduction','consignes'],
  week_label: ['sem','semaine'],
} as const
const allowedStatuses = new Set(['A_REDIGER','EN_CREATION','A_VALIDER','PLANIFIE','PUBLIE','REPORTE'])

function dateTime(dateValue: unknown, timeValue: unknown): string | null {
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) return dateValue.toISOString()
  const value=clean(dateValue), time=clean(timeValue)
  if (!value) return null
  const match=value.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  const iso=match?`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}T${(match[4]||time.split(':')[0]||'09').padStart(2,'0')}:${match[5]||time.split(':')[1]||'00'}`:value.includes('T')?value:value.replace(' ','T')+(value.includes(':')?'':`T${time||'09:00'}`)
  const parsed=new Date(iso)
  return Number.isNaN(parsed.getTime())?null:parsed.toISOString()
}

function normalizedStatus(raw:string){
  const value=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[\s-]+/g,'_')
  if (value==='OUI') return 'PUBLIE'
  if (value==='NON'||!value) return 'A_REDIGER'
  return value
}

export function editorialFromRows(rows: unknown[][], sheet='Feuille'): EditorialImportRow[] {
  if (!rows.length) throw new Error('Le fichier est vide.')
  const headerIndex=rows.findIndex(row=>row.map(key).includes('date')&&row.map(key).some(cell=>['titre','titreinfographietextesurvisuel','objectifdupost'].includes(cell)))
  if (headerIndex<0) throw new Error('Le calendrier doit contenir une ligne d’en-têtes avec Date et Titre du visuel (ou Titre).')
  const headers=rows[headerIndex].map(key)
  const indexes=Object.fromEntries(Object.entries(aliases).map(([field,names])=>[field,headers.findIndex(header=>(names as readonly string[]).includes(header))])) as Record<keyof typeof aliases,number>
  const get=(row:unknown[],field:keyof typeof aliases)=>indexes[field]<0?'':clean(row[indexes[field]])
  const content=rows.slice(headerIndex+1).map((row,index)=>({row,line:headerIndex+index+2})).filter(({row})=>row.some(cell=>clean(cell)))
  if (content.length>500) throw new Error('Import limité à 500 publications par fichier.')
  return content.map(({row,line})=>{
    const visual_title=get(row,'visual_title')
    const title=get(row,'title')||visual_title||get(row,'objective')||get(row,'theme')
    const when=dateTime(indexes.date<0?'':row[indexes.date],indexes.time<0?'':row[indexes.time])
    const platforms=get(row,'platforms').split(/\s*\+\s*|[|,;/]+/).map(x=>x.trim()).filter(Boolean)
    const status=normalizedStatus(get(row,'status'))
    const errors=[!title?'Titre manquant':'',!when?'Date invalide ou manquante':'',!allowedStatuses.has(status)?'Statut inconnu':''].filter(Boolean)
    return {line,sheet,title,publish_at:when||'',platforms,content_type:get(row,'content_type'),caption:get(row,'caption'),client:get(row,'client'),project:get(row,'project'),theme:get(row,'theme'),post_type:get(row,'post_type'),objective:get(row,'objective'),visual_title,visual_subtitle:get(row,'visual_subtitle'),hashtags:get(row,'hashtags'),production_notes:get(row,'production_notes'),week_label:get(row,'week_label'),status,error:errors.join(' · ')||null}
  })
}

export function editorialFromCsv(text:string,sheet='CSV'){return editorialFromRows(parseCsvRows(text.replace(/^\uFEFF/,'')),sheet)}
export async function editorialFromFile(file:File){
  if (/\.csv$/i.test(file.name)||file.type.includes('csv')) return editorialFromCsv(await file.text(),file.name)
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Utilisez un fichier CSV ou XLSX.')
  const {default:readXlsxFile,readSheetNames}=await import('read-excel-file')
  const sheets=await readSheetNames(file)
  const results=await Promise.all(sheets.map(async sheet=>{const rows=await readXlsxFile(file,{sheet});try{return editorialFromRows(rows as unknown[][],sheet)}catch(error){if(error instanceof Error&&error.message.includes('ligne d’en-têtes'))return [];throw error}}))
  const publications=results.flat()
  if (publications.length>500) throw new Error('Import limité à 500 publications par fichier.')
  if (!publications.length) throw new Error('Aucun onglet de calendrier éditorial reconnu.')
  return publications
}
