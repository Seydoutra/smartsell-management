import { FormEvent, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell, BriefcaseBusiness, CalendarDays, ChevronLeft, CircleDollarSign, Clapperboard,
  CheckCircle2, Download, FileText, LayoutDashboard, LockKeyhole, Mail, Menu, Moon, Package,
  Phone, Plus, Search, Settings, ShieldCheck, Sun, Users, X,
} from 'lucide-react'
import { companyProfile } from './lib/companyProfile'
import { statusTone } from './lib/statusTone'
import { demoData, DemoRecord } from './lib/demoData'
import { endSession, getDemoActivity, pulseSession, startSession, trackActivity } from './services/activityTracker'
import { isDemoMode } from './services/supabase'
import ProductionApp from './ProductionAppV2'
import LandingPage from './LandingPage'
import ReferralLandingPage from './ReferralLandingPage'
import MarketingPage from './MarketingPage'
import { marketingPath, marketingRouteFromPath, marketingRoutes, type MarketingRoute } from './lib/marketingRoutes'
import SignupPage from './SignupPage'
import LegalPage from './LegalPage'
import VerifyDocumentPage from './VerifyDocumentPage'
import { applyBrandTheme, readBrandTheme } from './lib/brandTheme'

type Theme = 'light' | 'dark'
type Page = 'Dashboard' | 'Prospects' | 'Clients' | 'Projets' | 'Tâches' | 'Planning' | 'Production' | 'Éditorial' | 'Finance' | 'Matériel' | 'Équipe' | 'Documents' | 'Communication' | 'Administration' | 'Paramètres'

const nav: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Dashboard', icon: LayoutDashboard }, { label: 'Prospects', icon: BriefcaseBusiness },
  { label: 'Clients', icon: Users }, { label: 'Projets', icon: Clapperboard }, { label: 'Tâches', icon: FileText },
  { label: 'Planning', icon: CalendarDays }, { label: 'Production', icon: Clapperboard },
  { label: 'Éditorial', icon: CalendarDays }, { label: 'Finance', icon: CircleDollarSign },
  { label: 'Matériel', icon: Package }, { label: 'Équipe', icon: Users }, { label: 'Documents', icon: FileText },
  { label: 'Communication', icon: Mail }, { label: 'Administration', icon: ShieldCheck }, { label: 'Paramètres', icon: Settings },
]

const activities = [
  ['09:30', 'Tournage produit', 'Studio Nimba', 'Production'],
  ['11:00', 'Validation campagne', 'Maison Kanu', 'Client'],
  ['14:30', 'Point projet web', 'Nova Conseil', 'Réunion'],
  ['17:00', 'Publication Instagram', 'Smartsell', 'Éditorial'],
]

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('superadmin@smartsell.local')
  const [password, setPassword] = useState('Smartsell@2026!')
  const [error, setError] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (email === 'superadmin@smartsell.local' && password === 'Smartsell@2026!') onLogin()
    else setError('Identifiants incorrects. Utilisez le compte de démonstration indiqué.')
  }
  return <main className="login-shell">
    <section className="login-brand">
      <img src={companyProfile.logo_light} className="login-logo" alt="Smartsell" />
      <div className="brand-orbit" aria-hidden="true"><span /><span /><span /></div>
      <div className="login-manifesto"><p>L’agence, en mouvement.</p><h1>GÉREZ.<br/>CRÉEZ.<br/><em>LIVREZ.</em><br/>GRANDISSEZ.</h1></div>
      <div className="contact-line"><span>{companyProfile.address}</span><span>{companyProfile.email}</span></div>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="mobile-brand"><img src={companyProfile.logo_light} alt="Smartsell" /></div>
        <div className="eyebrow"><i /> ESPACE DE TRAVAIL</div>
        <h2>Heureux de vous revoir.</h2><p className="muted">Connectez-vous pour piloter l’activité de l’agence.</p>
        <label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" /></label>
        <label>Mot de passe<input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" /></label>
        <div className="form-row"><label className="check"><input type="checkbox" defaultChecked /> Rester connecté</label><button type="button" className="link">Mot de passe oublié ?</button></div>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-btn" type="submit">Ouvrir mon espace <span>→</span></button>
        <div className="demo-hint"><strong>Mode démonstration</strong><span>Les identifiants sont déjà renseignés.</span></div>
      </form>
    </section>
  </main>
}

function Dashboard() {
  return <div className="dashboard-grid">
    <section className="greeting"><div><div className="eyebrow"><i /> VENDREDI 25 SEPTEMBRE</div><h1>Bonjour, Seydou.</h1><p>Voici ce qui fait avancer Smartsell aujourd’hui.</p></div><button className="primary-btn compact"><Plus size={18}/> Créer</button></section>
    <section className="kpis">
      <article className="kpi featured"><div className="kpi-top"><span>Chiffre d’affaires</span><CircleDollarSign size={18}/></div><strong>148,6 M</strong><small>GNF · +12,4% ce mois</small><div className="spark">▁▃▂▅▄▆▅█</div></article>
      <article className="kpi"><div className="kpi-top"><span>Projets actifs</span><BriefcaseBusiness size={18}/></div><strong>12</strong><small>4 livraisons cette semaine</small><div className="progress"><i style={{width:'68%'}}/></div></article>
      <article className="kpi"><div className="kpi-top"><span>Factures à suivre</span><FileText size={18}/></div><strong>7</strong><small>28,4 M GNF à encaisser</small><div className="mini-badges"><b>3 en retard</b><span>4 envoyées</span></div></article>
      <article className="kpi"><div className="kpi-top"><span>Tâches du jour</span><CalendarDays size={18}/></div><strong>18</strong><small>11 terminées · 2 urgentes</small><div className="progress yellow"><i style={{width:'61%'}}/></div></article>
    </section>
    <section className="command-center panel">
      <div className="panel-title"><div><span className="eyebrow"><i/> COMMAND CENTER</span><h2>Aujourd’hui chez Smartsell</h2></div><button className="ghost-btn">Voir le planning</button></div>
      <div className="timeline">
        {activities.map(([time,title,client,type], i) => <motion.div className="event" key={title} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*.05}}>
          <time>{time}</time><span className={`event-dot d${i}`}/><div><strong>{title}</strong><small>{client}</small></div><em>{type}</em>
        </motion.div>)}
      </div>
    </section>
    <section className="panel revenue-panel"><div className="panel-title"><div><span className="eyebrow">PERFORMANCE</span><h2>Revenus & dépenses</h2></div><span className="selectish">6 derniers mois⌄</span></div>
      <div className="chart-legend"><span><i className="purple"/>Revenus</span><span><i className="yellow-dot"/>Dépenses</span></div>
      <div className="bar-chart" aria-label="Graphique des revenus et dépenses">{[42,58,48,70,63,88].map((v,i)=><div className="bar-group" key={i}><span style={{height:`${v}%`}}/><i style={{height:`${Math.max(18,v-30)}%`}}/><small>{['Avr','Mai','Juin','Juil','Août','Sept'][i]}</small></div>)}</div>
    </section>
    <section className="panel pipeline"><div className="panel-title"><div><span className="eyebrow">CRM</span><h2>Pipeline commercial</h2></div><b>86,5 M GNF</b></div>
      {[['Nouveaux','8','38%'],['Propositions','5','64%'],['Négociation','3','78%'],['Gagnés','6','92%']].map((x,i)=><div className="pipe" key={x[0]}><span className={`pipe-index p${i}`}>{x[1]}</span><div><strong>{x[0]}</strong><i><b style={{width:x[2]}}/></i></div><small>{x[2]}</small></div>)}
    </section>
    <section className="panel team-panel"><div className="panel-title"><div><span className="eyebrow">ÉQUIPE</span><h2>Disponibilité</h2></div><button className="icon-btn">→</button></div><div className="avatars"><span>AK</span><span>MD</span><span>FS</span><span>IB</span><span>+4</span></div><p><strong>6 personnes</strong> disponibles aujourd’hui</p><div className="availability"><i/><span>Disponible</span><i/><span>En mission</span><i/><span>Absent</span></div></section>
  </div>
}

const pageCopy: Partial<Record<Page,{title:string;copy:string}>> = {
  Prospects:{title:'Pipeline commercial',copy:'Transformez les opportunités en clients, sans perdre une relance.'},
  Clients:{title:'Portefeuille clients',copy:'Toutes les relations, projets et pièces d’un client au même endroit.'},
  Projets:{title:'Projets en mouvement',copy:'Pilotez les délais, les équipes, les livrables et la rentabilité.'},
  Tâches:{title:'Travail à accomplir',copy:'Les priorités de l’équipe, organisées et clairement assignées.'},
  Production:{title:'Production',copy:'Tournages, shootings, équipes et matériel synchronisés.'},
  Éditorial:{title:'Calendrier éditorial',copy:'De l’idée à la publication, suivez chaque validation.'},
  Finance:{title:'Finance',copy:'Devis, factures, paiements et dépenses, avec une vue nette sur la marge.'},
  Matériel:{title:'Parc matériel',copy:'Disponibilités, réservations, sorties, retours et maintenance.'},
  Équipe:{title:'Équipe',copy:'Rôles, disponibilité et charge de travail.'},
  Documents:{title:'Documents',copy:'Contrats, briefs et livrables classés par client et projet.'},
  Communication:{title:'Centre de communication',copy:'SMS, emails, campagnes et historique depuis un canal maîtrisé.'},
  Administration:{title:'Administration',copy:'Utilisateurs, permissions, sécurité et journal d’audit.'},
}

function ModulePage({ page }: { page: Page }) {
  const initial = demoData[page] || []
  const storageKey = `smartsell-demo-${page}`
  const [rows,setRows] = useState<DemoRecord[]>(()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'null')||initial}catch{return initial}})
  const [query,setQuery] = useState('')
  const [open,setOpen] = useState(false)
  const [title,setTitle] = useState('')
  const [subtitle,setSubtitle] = useState('')
  const copy = pageCopy[page] || {title:page,copy:`Gérez vos éléments ${page.toLowerCase()} depuis un espace unifié.`}
  const filtered = rows.filter(r=>(r.title+r.subtitle+r.status).toLowerCase().includes(query.toLowerCase()))
  const add=(e:FormEvent)=>{e.preventDefault();const next=[{id:crypto.randomUUID(),title,subtitle:subtitle||'Ajouté en mode démonstration',status:'Nouveau',meta:'À l’instant'},...rows];setRows(next);localStorage.setItem(storageKey,JSON.stringify(next));trackActivity('Élément créé',page,title);setOpen(false);setTitle('');setSubtitle('')}
  const exportCsv=()=>{const csv=['Nom,Description,Statut,Détail',...filtered.map(r=>[r.title,r.subtitle,r.status,r.meta].map(v=>`"${v.replaceAll('"','""')}"`).join(','))].join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`smartsell-${page.toLowerCase()}.csv`;a.click();URL.revokeObjectURL(url);trackActivity('Export CSV',page,`${filtered.length} lignes exportées`)}
  return <section className="module-page">
    <div className="module-head"><div><span className="eyebrow"><i/> SMARTSELL MANAGEMENT</span><h1>{copy.title}</h1><p>{copy.copy}</p></div><button className="primary-btn compact" onClick={()=>setOpen(true)}><Plus size={17}/> Ajouter</button></div>
    {page==='Communication'&&<div className="test-mode"><b>MODE TEST</b><span>Aucun SMS ou email réel ne sera envoyé.</span></div>}
    <div className="filter-bar"><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Rechercher dans ${page.toLowerCase()}…`}/></label><button onClick={exportCsv}><Download size={16}/> Exporter CSV</button><span>{filtered.length} éléments</span></div>
    <div className="records panel">
      <div className="records-head"><span>Nom</span><span>Statut</span><span>Détail</span><span>Valeur</span></div>
      {filtered.map((row,i)=><motion.article key={row.id} initial={{opacity:0,y:7}} animate={{opacity:1,y:0}} transition={{delay:i*.025}}>
        <div className="record-main"><span className="record-avatar">{row.title.slice(0,2).toUpperCase()}</span><div><strong>{row.title}</strong><small>{row.subtitle}</small></div></div><span className={`status ${row.status.toLowerCase().includes('retard')||row.status==='Urgent'?'danger':''}`}>{row.status}</span><span className="record-meta">{row.meta}</span><b className="record-amount">{row.amount||'—'}</b>
      </motion.article>)}
      {!filtered.length&&<div className="empty-state"><Search/><h3>Aucun résultat</h3><p>Essayez un autre mot ou créez un nouvel élément.</p></div>}
    </div>
    <AnimatePresence>{open&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={()=>setOpen(false)}><motion.form className="modal" onSubmit={add} initial={{opacity:0,y:20,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:10,scale:.98}} onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow"><i/> NOUVEL ÉLÉMENT</span><h2>Ajouter à {page.toLowerCase()}</h2></div><button type="button" className="icon-btn" onClick={()=>setOpen(false)}><X/></button></div>
      <label>Nom<input autoFocus required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Nom ou intitulé"/></label><label>Description<input value={subtitle} onChange={e=>setSubtitle(e.target.value)} placeholder="Client, contact ou contexte"/></label>
      <div className="modal-actions"><button type="button" className="ghost-cancel" onClick={()=>setOpen(false)}>Annuler</button><button className="primary-btn compact" type="submit">Enregistrer</button></div>
    </motion.form></motion.div>}</AnimatePresence>
  </section>
}

function SettingsPage(){
  const [saved,setSaved]=useState(false)
  return <section className="module-page"><div className="module-head"><div><span className="eyebrow"><i/> CONFIGURATION</span><h1>Paramètres entreprise</h1><p>Ces informations alimentent les devis, factures, emails et documents.</p></div></div><form className="settings-card panel" onSubmit={e=>{e.preventDefault();setSaved(true);setTimeout(()=>setSaved(false),2400)}}><h2>Profil de l’entreprise</h2><div className="settings-grid"><label>Nom<input defaultValue={companyProfile.company_name}/></label><label>Email<input defaultValue={companyProfile.email}/></label><label>Téléphone<input defaultValue={companyProfile.phone}/></label><label>WhatsApp<input defaultValue={companyProfile.whatsapp}/></label><label className="wide">Adresse<input defaultValue={companyProfile.address}/></label><label>Devise<select defaultValue="GNF"><option>GNF</option><option>EUR</option><option>USD</option></select></label><label>Préfixe facture<input defaultValue="FAC"/></label></div><button className="primary-btn compact">Enregistrer les modifications</button>{saved&&<span className="saved-toast">Modifications enregistrées</span>}</form></section>
}

type AccessUser = { id:string; name:string; role:string; department:string; active:boolean; grants:string[]; sms:number; emails:number; calls:number }
const initialAccessUsers: AccessUser[] = [
  {id:'ts',name:'Traoré Seydou',role:'SUPER_ADMIN',department:'Direction · Manager',active:true,grants:['CRM','Projets','Finance','Communication','Administration'],sms:1000,emails:2500,calls:100},
  {id:'md',name:'Mamadou Diallo',role:'COMMERCIAL',department:'Commercial',active:true,grants:['CRM','Projets','Communication'],sms:100,emails:250,calls:40},
  {id:'fs',name:'Fatou Sow',role:'VIDEASTE',department:'Production',active:true,grants:['Projets','Production','Matériel'],sms:0,emails:20,calls:0},
  {id:'ib',name:'Ibrahima Bah',role:'DEVELOPPEUR',department:'Digital',active:true,grants:['Projets','Tâches','Documents'],sms:0,emails:20,calls:0},
]
const accessModules=['CRM','Projets','Production','Finance','Matériel','Communication','Administration']

function AdministrationPage(){
  const [users,setUsers]=useState<AccessUser[]>(()=>{try{return JSON.parse(localStorage.getItem('smartsell-access-users')||'null')||initialAccessUsers}catch{return initialAccessUsers}})
  const [selected,setSelected]=useState(0)
  const user=users[selected]
  const activity=getDemoActivity()
  const update=(patch:Partial<AccessUser>)=>{const next=users.map((u,i)=>i===selected?{...u,...patch}:u);setUsers(next);localStorage.setItem('smartsell-access-users',JSON.stringify(next))}
  const toggle=(module:string)=>update({grants:user.grants.includes(module)?user.grants.filter(x=>x!==module):[...user.grants,module]})
  return <section className="module-page"><div className="module-head"><div><span className="eyebrow"><i/> SÉCURITÉ & GOUVERNANCE</span><h1>Droits et limites utilisateurs</h1><p>Chaque accès est accordé selon le rôle, puis affiné individuellement.</p></div><button className="primary-btn compact"><Plus size={17}/> Ajouter un membre</button></div>
    <div className="security-note"><LockKeyhole/><div><strong>Principe du moindre privilège</strong><span>Un utilisateur ne voit que les modules autorisés. Toute modification est enregistrée dans le journal d’audit.</span></div></div>
    <div className="access-layout"><div className="user-list panel">{users.map((u,i)=><button key={u.id} onClick={()=>setSelected(i)} className={selected===i?'selected':''}><span>{u.name.split(' ').map(x=>x[0]).join('')}</span><div><strong>{u.name}</strong><small>{u.department} · {u.role.replaceAll('_',' ')}</small></div><i className={u.active?'online':''}/></button>)}</div>
    <div className="access-editor panel"><div className="access-title"><div><span className="eyebrow">AUTORISATIONS DE</span><h2>{user.name}</h2></div><label className="active-switch"><input type="checkbox" checked={user.active} onChange={e=>update({active:e.target.checked})}/><span>{user.active?'Compte actif':'Compte suspendu'}</span></label></div>
      <h3>Modules accessibles</h3><div className="module-rights">{accessModules.map(m=><label key={m} className={user.grants.includes(m)?'granted':''}><input type="checkbox" checked={user.grants.includes(m)} onChange={()=>toggle(m)}/><span><CheckCircle2/> {m}</span></label>)}</div>
      <h3>Limites quotidiennes</h3><div className="limits-grid"><label>SMS<input type="number" min="0" value={user.sms} onChange={e=>update({sms:Number(e.target.value)})}/><small>messages / jour</small></label><label>Emails<input type="number" min="0" value={user.emails} onChange={e=>update({emails:Number(e.target.value)})}/><small>emails / jour</small></label><label>Appels<input type="number" min="0" value={user.calls} onChange={e=>update({calls:Number(e.target.value)})}/><small>appels / jour</small></label></div>
    </div></div>
    <div className="monitoring-grid"><article className="panel"><span>Temps actif aujourd’hui</span><strong>6 h 24</strong><small>Traoré Seydou · session en cours</small></article><article className="panel"><span>Collaborateurs connectés</span><strong>3 / 4</strong><small>Dernière connexion il y a 4 min</small></article><article className="panel"><span>Actions aujourd’hui</span><strong>47</strong><small>0 alerte de sécurité</small></article></div>
    <div className="audit-panel panel"><div className="panel-title"><div><span className="eyebrow">SURVEILLANCE D’ACTIVITÉ</span><h2>Journal récent</h2></div><span className="selectish">Temps actif · actions métier</span></div>{activity.slice(0,6).map(ev=><div className="audit-row" key={ev.id}><span className="record-avatar">{ev.user.split(' ').map(x=>x[0]).join('').slice(0,2)}</span><div><strong>{ev.user}</strong><small>{ev.action} · {ev.detail}</small></div><b>{ev.module}</b><time>{new Date(ev.at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</time></div>)}</div>
  </section>
}

function CommunicationPage(){
  const channels=[{icon:Mail,title:'Email',status:'Prêt à configurer',copy:'SMTP, Resend, SendGrid ou fournisseur API.',metric:'2 500 / jour'},{icon:Phone,title:'SMS',status:'Mode test',copy:'API générique, Twilio ou Africa’s Talking.',metric:'1 000 / jour'},{icon:Phone,title:'Appels',status:'API à connecter',copy:'Twilio Voice, Vonage ou opérateur compatible.',metric:'100 / jour'}]
  return <section className="module-page"><div className="module-head"><div><span className="eyebrow"><i/> COMMUNICATION OMNICANALE</span><h1>SMS, emails & appels</h1><p>Contactez clients et prospects depuis un espace sécurisé et traçable.</p></div><button className="primary-btn compact"><Plus size={17}/> Nouvelle campagne</button></div><div className="test-mode"><b>MODE TEST</b><span>Les envois et appels sont redirigés vers les coordonnées de test tant que les API ne sont pas validées.</span></div>
    <div className="channel-grid">{channels.map((c,i)=><article className="panel" key={c.title}><div className="channel-icon"><c.icon/></div><span className={`status ${statusTone(c.status)}`}>{c.status}</span><h2>{c.title}</h2><p>{c.copy}</p><div className="channel-foot"><span>Limite Super Admin</span><strong>{c.metric}</strong></div><button>{i===2?'Configurer la téléphonie':'Configurer le fournisseur'} →</button></article>)}</div>
    <div className="panel comm-safety"><h2>Protections actives</h2><div><span><CheckCircle2/> Consentement et opt-out</span><span><CheckCircle2/> Confirmation avant envoi massif</span><span><CheckCircle2/> Quotas par utilisateur</span><span><CheckCircle2/> Journal complet</span><span><CheckCircle2/> Secrets côté serveur</span><span><CheckCircle2/> Coûts réels uniquement</span></div></div>
  </section>
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<Page>('Dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('smartsell-theme') as Theme) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  useEffect(()=>{ document.documentElement.dataset.theme=theme; localStorage.setItem('smartsell-theme',theme)},[theme])
  useEffect(()=>{trackActivity('Page consultée',page,`Ouverture du module ${page}`)},[page])
  useEffect(()=>{const timer=window.setInterval(pulseSession,60_000);return()=>window.clearInterval(timer)},[])
  return <div className={`app-shell ${collapsed?'is-collapsed':''}`}>
    <AnimatePresence>{mobileOpen && <motion.button className="scrim" aria-label="Fermer le menu" onClick={()=>setMobileOpen(false)} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}/>}</AnimatePresence>
    <aside className={mobileOpen?'mobile-open':''}>
      <div className="side-head"><img src={companyProfile.logo_light} alt="Smartsell"/><button className="collapse-btn" onClick={()=>setCollapsed(!collapsed)}><ChevronLeft/></button><button className="mobile-close" onClick={()=>setMobileOpen(false)}><X/></button></div>
      <nav><small>ESPACE</small>{nav.map(item=><button key={item.label} className={page===item.label?'active':''} onClick={()=>{setPage(item.label);setMobileOpen(false)}}><item.icon/><span>{item.label}</span>{item.label==='Tâches'&&<b>7</b>}</button>)}</nav>
      <div className="side-bottom"><div className="user-avatar">TS</div><div><strong>Traoré Seydou</strong><small>Manager · Super Admin</small></div><button onClick={onLogout}>↗</button></div>
    </aside>
    <div className="app-main"><header><button className="mobile-menu" onClick={()=>setMobileOpen(true)}><Menu/></button><button className="search"><Search/><span>Rechercher partout…</span><kbd>⌘ K</kbd></button><div className="top-actions"><button className="icon-btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')} aria-label="Changer de thème">{theme==='dark'?<Sun/>:<Moon/>}</button><button className="icon-btn notification"><Bell/><i/></button><button className="quick"><Plus/> <span>Créer</span></button></div></header>
      <main><AnimatePresence mode="wait"><motion.div key={page} initial={{opacity:0,y:8,filter:'blur(3px)'}} animate={{opacity:1,y:0,filter:'blur(0)'}} exit={{opacity:.96,y:-2}} transition={{duration:.2}}>{page==='Dashboard'?<Dashboard/>:page==='Paramètres'?<SettingsPage/>:page==='Administration'?<AdministrationPage/>:page==='Communication'?<CommunicationPage/>:<ModulePage page={page}/>}</motion.div></AnimatePresence></main>
    </div>
  </div>
}

function DemoApp(){
  const [loggedIn,setLoggedIn]=useState(()=>sessionStorage.getItem('smartsell-demo-session')==='true')
  const login=()=>{sessionStorage.setItem('smartsell-demo-session','true');startSession();setLoggedIn(true)}
  const logout=()=>{endSession();sessionStorage.removeItem('smartsell-demo-session');setLoggedIn(false)}
  return <AnimatePresence mode="wait">{loggedIn?<motion.div key="app" initial={{opacity:0}} animate={{opacity:1}}><Shell onLogout={logout}/></motion.div>:<motion.div key="login" initial={{opacity:0}} animate={{opacity:1}}><Login onLogin={login}/></motion.div>}</AnimatePresence>
}

export default function App(){
  useEffect(() => { applyBrandTheme(readBrandTheme()) }, [])
  type Route = 'landing'|'app'|'signup'|'referral'|'privacy'|'terms'|'verify'|MarketingRoute
  const getRoute=():Route=>{const hash=window.location.hash;const page=decodeURIComponent(hash.slice(2).split('?')[0]) as MarketingRoute;const pathRoute=marketingRouteFromPath(window.location.pathname);return hash.startsWith('#verify?')?'verify':hash==='#app'?'app':hash.startsWith('#signup')?'signup':hash==='#privacy'?'privacy':hash==='#terms'?'terms':hash.startsWith('#/')?(marketingRoutes.includes(page)?page:'app'):pathRoute==='parrainage'||hash==='#parrainage'?'referral':pathRoute||'landing'}
  const [route,setRoute]=useState<Route>(getRoute)
  useEffect(()=>{
    const sync=()=>{setRoute(getRoute());window.scrollTo({top:0})}
    window.addEventListener('hashchange',sync)
    return()=>window.removeEventListener('hashchange',sync)
  },[])
  const navigate=(next:Route)=>{const destination=next==='landing'?import.meta.env.BASE_URL:next==='referral'?marketingPath('parrainage'):marketingRoutes.includes(next as MarketingRoute)?marketingPath(next as MarketingRoute):`${import.meta.env.BASE_URL}#${next}`;if(location.pathname+location.hash!==destination){location.assign(destination);return}setRoute(next);window.scrollTo({top:0})}
  if(route==='privacy'||route==='terms')return <LegalPage kind={route} onBack={()=>navigate('landing')}/>
  if(route==='verify')return <VerifyDocumentPage/>
  if(route==='referral')return <ReferralLandingPage onBack={()=>navigate('landing')} onSignUp={()=>navigate('signup')} onLogin={()=>navigate('app')}/>
  if(marketingRoutes.includes(route as MarketingRoute))return <MarketingPage route={route as MarketingRoute} onHome={()=>navigate('landing')} onSignUp={()=>navigate('signup')} onLogin={()=>navigate('app')}/>
  if(route==='signup')return <SignupPage onBack={()=>navigate('landing')} onAccess={()=>navigate('app')}/>
  if(route==='app')return isDemoMode?<DemoApp/>:<ProductionApp/>
  return <LandingPage onOpenApp={()=>navigate('app')} onSignUp={()=>navigate('signup')}/>
}
