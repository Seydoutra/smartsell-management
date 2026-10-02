import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight, ArrowUp, BarChart3, Bot, BriefcaseBusiness, CalendarDays, Camera, Check,
  ChevronLeft, ChevronRight, CircleDollarSign, Clock3, FileCheck2, Gauge,
  Layers3, Mail, Megaphone, Menu, MessageSquareText, PackageCheck, Palette,
  Globe2, MessageCircle, Moon, Play, Settings2, ShieldCheck, Sparkles, Sun, Target, Users, WandSparkles, X, Zap,
} from 'lucide-react'
import { companyProfile } from './lib/companyProfile'
import './landing.css'

type Feature = {
  icon: typeof Gauge
  number: string
  title: string
  copy: string
  details: string[]
}

type Language = 'fr' | 'en'
type LandingTheme = 'dark' | 'light'

const features: Feature[] = [
  { icon: Gauge, number: '01', title: 'Centre de pilotage', copy: 'Décidez à partir d’une vue claire et actualisée de toute l’entreprise.', details: ['Chiffre d’affaires, encaissements et dépenses en temps réel', 'Projets, échéances et charge d’équipe en un coup d’œil', 'Alertes prioritaires et prochaines actions', 'Briefing de direction assisté par l’IA'] },
  { icon: BarChart3, number: '02', title: 'CRM & prospects', copy: 'Transformez chaque opportunité en relation suivie, du premier contact à la vente.', details: ['Pipeline commercial personnalisable', 'Fiches prospects, historique et sources', 'Relances, rendez-vous et rappels', 'Budgets, probabilités et prévisions de vente'] },
  { icon: Users, number: '03', title: 'Clients & portail', copy: 'Regroupez échanges, projets, documents et validations dans une fiche complète.', details: ['Contacts, entreprises et historique relationnel', 'Projets, factures et documents liés', 'Portail client sécurisé', 'Validation des créations et suivi des retours'] },
  { icon: BriefcaseBusiness, number: '04', title: 'Projets & tâches', copy: 'Planifiez, assignez et livrez sans perdre le fil entre les équipes.', details: ['Projets, budgets, statuts et priorités', 'Tâches, responsables, sous-tâches et rappels', 'Progression, délais et dépendances', 'Commentaires, pièces jointes et historique'] },
  { icon: CalendarDays, number: '05', title: 'Planning partagé', copy: 'Donnez à chacun un agenda opérationnel lisible, sur le terrain comme au bureau.', details: ['Calendrier équipe et vues par collaborateur', 'Échéances, disponibilités et conflits', 'Rappels multicanaux', 'Synchronisation avec les calendriers externes'] },
  { icon: Camera, number: '06', title: 'Production créative', copy: 'Organisez les tournages et productions depuis le brief jusqu’aux livrables.', details: ['Feuilles de service et déroulés de production', 'Équipes, rôles, lieux et horaires', 'Matériel affecté à chaque mission', 'Livrables, validations et versions'] },
  { icon: Layers3, number: '07', title: 'Éditorial & validation', copy: 'Cadencez vos publications et simplifiez les circuits d’approbation.', details: ['Calendrier éditorial multicanal', 'Médias, légendes, responsables et dates', 'Validation interne puis validation client', 'Versions, retours et statut de publication'] },
  { icon: CircleDollarSign, number: '08', title: 'Finance & facturation', copy: 'Passez du devis au paiement avec une lecture immédiate de la rentabilité.', details: ['Devis, factures et reçus personnalisés', 'Paiements, échéances et relances', 'Dépenses, justificatifs et approbations', 'Bons de commande, livraison et tableaux financiers'] },
  { icon: PackageCheck, number: '09', title: 'Matériel & fournisseurs', copy: 'Sachez ce qui est disponible, réservé, en mission ou en maintenance.', details: ['Inventaire et état du matériel', 'Réservations, mouvements et affectations', 'Maintenance et alertes de disponibilité', 'Catalogue de services et suivi fournisseurs'] },
  { icon: MessageSquareText, number: '10', title: 'Communication', copy: 'Communiquez avec vos contacts sans sortir de leur contexte métier.', details: ['SMS, e-mails, appels et campagnes', 'Groupes, listes d’appel et modèles', 'Consentements et désinscriptions', 'Quotas, journaux et performance des envois'] },
  { icon: ShieldCheck, number: '11', title: 'Équipe, RH & accès', copy: 'Structurez les responsabilités avec des droits adaptés à chaque rôle.', details: ['Rôles et permissions fines', 'Dossiers collaborateurs et contrats', 'Congés, disponibilités et documents RH', 'Comptes temporaires et limites d’accès'] },
  { icon: WandSparkles, number: '12', title: 'IA & automatisations', copy: 'Faites remonter l’essentiel et automatisez les tâches répétitives.', details: ['Copilote de management contextualisé', 'Scénarios de croissance et recommandations', 'Briefs et synthèses automatiques', 'Automatisations supervisées et traçables'] },
]

const featuresEn: Feature[] = [
  { icon: Gauge, number: '01', title: 'Command center', copy: 'Make decisions from a clear, live view of your entire company.', details: ['Real-time revenue, collections and expenses', 'Projects, deadlines and team workload at a glance', 'Priority alerts and next actions', 'AI-assisted executive briefing'] },
  { icon: BarChart3, number: '02', title: 'CRM & leads', copy: 'Turn every opportunity into a managed relationship, from first contact to sale.', details: ['Customizable sales pipeline', 'Lead records, history and sources', 'Follow-ups, meetings and reminders', 'Budgets, probabilities and sales forecasts'] },
  { icon: Users, number: '03', title: 'Clients & portal', copy: 'Bring conversations, projects, files and approvals into one complete record.', details: ['Contacts, companies and relationship history', 'Linked projects, invoices and documents', 'Secure client portal', 'Creative approvals and feedback tracking'] },
  { icon: BriefcaseBusiness, number: '04', title: 'Projects & tasks', copy: 'Plan, assign and deliver without losing momentum between teams.', details: ['Projects, budgets, statuses and priorities', 'Tasks, owners, subtasks and reminders', 'Progress, deadlines and dependencies', 'Comments, attachments and history'] },
  { icon: CalendarDays, number: '05', title: 'Shared planning', copy: 'Give everyone a clear operational schedule, in the field or at the office.', details: ['Team calendar and employee views', 'Deadlines, availability and conflicts', 'Multi-channel reminders', 'External calendar synchronization'] },
  { icon: Camera, number: '06', title: 'Creative production', copy: 'Run shoots and productions from brief to final delivery.', details: ['Call sheets and production schedules', 'Teams, roles, locations and times', 'Equipment assigned to every job', 'Deliverables, approvals and versions'] },
  { icon: Layers3, number: '07', title: 'Editorial & approval', copy: 'Keep publishing on pace and simplify every approval workflow.', details: ['Multi-channel editorial calendar', 'Media, captions, owners and dates', 'Internal and client approval', 'Versions, feedback and publishing status'] },
  { icon: CircleDollarSign, number: '08', title: 'Finance & billing', copy: 'Move from quote to payment with an immediate view of profitability.', details: ['Branded quotes, invoices and receipts', 'Payments, due dates and reminders', 'Expenses, receipts and approvals', 'Purchase orders, delivery and financial dashboards'] },
  { icon: PackageCheck, number: '09', title: 'Equipment & vendors', copy: 'Know what is available, booked, in use or under maintenance.', details: ['Equipment inventory and condition', 'Bookings, movements and assignments', 'Maintenance and availability alerts', 'Service catalog and vendor tracking'] },
  { icon: MessageSquareText, number: '10', title: 'Communication', copy: 'Communicate with every contact without leaving their business context.', details: ['SMS, email, calls and campaigns', 'Groups, call lists and templates', 'Consent and unsubscribe management', 'Quotas, logs and delivery performance'] },
  { icon: ShieldCheck, number: '11', title: 'Team, HR & access', copy: 'Structure responsibilities with precise permissions for every role.', details: ['Granular roles and permissions', 'Employee records and contracts', 'Leave, availability and HR documents', 'Temporary accounts and access limits'] },
  { icon: WandSparkles, number: '12', title: 'AI & automation', copy: 'Surface what matters and automate repetitive work.', details: ['Context-aware management copilot', 'Growth scenarios and recommendations', 'Automatic briefs and summaries', 'Supervised, traceable automations'] },
]

const productScenes = [
  { key: 'direction', label: 'Direction', icon: Gauge, person: 'Awa', title: 'Décider avant que le problème arrive', note: '3 décisions prioritaires détectées par SmartSell.', stats: [['148,6 M', 'CA ce mois'], ['12', 'Projets actifs'], ['86%', 'Objectifs']], items: ['Valider le budget de la campagne Kanu', 'Réaffecter l’équipe disponible', 'Relancer 3 factures échues'] },
  { key: 'crm', label: 'CRM', icon: Target, person: 'Fatou', title: 'Faire avancer chaque opportunité', note: 'Deux prospects chauds attendent une proposition.', stats: [['24', 'Prospects'], ['8', 'Propositions'], ['64%', 'Conversion']], items: ['Nimba Group · Nouveau', 'Kaloum Tech · Proposition', 'Maison Kanu · Négociation'] },
  { key: 'projects', label: 'Projets', icon: BriefcaseBusiness, person: 'Awa', title: 'Orchestrer les livrables sans friction', note: 'Le projet Kanu passe en validation client.', stats: [['12', 'En cours'], ['4', 'À livrer'], ['91%', 'À l’heure']], items: ['Identité Maison Kanu · 88%', 'Spot Nimba · 64%', 'Lancement Kaloum · 42%'] },
  { key: 'production', label: 'Production', icon: Camera, person: 'Moussa', title: 'Suivre le tournage minute par minute', note: 'Feuille de service prête. Départ dans 45 min.', stats: [['09:30', 'Appel équipe'], ['11:00', 'Tournage'], ['4 / 4', 'Équipements']], items: ['Récupérer la Sony A7 IV', 'Rejoindre Maison Kanu — Kipé', 'Déposer les rushes avant 18:00'] },
  { key: 'editorial', label: 'Éditorial', icon: Megaphone, person: 'Mariam', title: 'Voir toute la stratégie de contenu', note: '7 contenus programmés, 2 attendent une validation.', stats: [['18', 'Contenus'], ['7', 'Planifiés'], ['92%', 'Cadence']], items: ['Reel · Coulisses du tournage', 'Carrousel · Offre du mois', 'LinkedIn · Cas client Kanu'] },
  { key: 'finance', label: 'Finance', icon: CircleDollarSign, person: 'Ibrahima', title: 'Garder la trésorerie sous contrôle', note: '28,4 M GNF restent à encaisser sur 7 factures.', stats: [['7', 'À encaisser'], ['3', 'À valider'], ['92%', 'À jour']], items: ['FAC-0248 · 12,4 M GNF', 'FAC-0251 · 9,2 M GNF', 'FAC-0255 · 6,8 M GNF'] },
  { key: 'team', label: 'Équipe', icon: Users, person: 'Awa', title: 'Équilibrer la charge de toute l’équipe', note: 'Moussa se libère demain à 14 h.', stats: [['14', 'Membres'], ['8', 'Disponibles'], ['82%', 'Capacité']], items: ['Production · 74% de charge', 'Commercial · 68% de charge', 'Design · 91% de charge'] },
  { key: 'ai', label: 'Copilote IA', icon: Bot, person: 'Awa', title: 'Transformer les données en décisions', note: 'La marge du projet Kanu peut gagner 8 points.', stats: [['3', 'Alertes'], ['6', 'Actions'], ['+18%', 'Potentiel']], items: ['Réduire un poste de dépense', 'Avancer la relance Nimba', 'Optimiser le planning studio'] },
]

const productScenesEn = [
  { key: 'direction', label: 'Management', icon: Gauge, person: 'Awa', title: 'Decide before problems happen', note: 'SmartSell detected 3 priority decisions.', stats: [['148.6 M', 'Revenue this month'], ['12', 'Active projects'], ['86%', 'Targets']], items: ['Approve the Kanu campaign budget', 'Reassign the available team', 'Follow up on 3 overdue invoices'] },
  { key: 'crm', label: 'CRM', icon: Target, person: 'Fatou', title: 'Move every opportunity forward', note: 'Two hot leads are waiting for a proposal.', stats: [['24', 'Leads'], ['8', 'Proposals'], ['64%', 'Conversion']], items: ['Nimba Group · New', 'Kaloum Tech · Proposal', 'Maison Kanu · Negotiation'] },
  { key: 'projects', label: 'Projects', icon: BriefcaseBusiness, person: 'Awa', title: 'Orchestrate deliverables without friction', note: 'The Kanu project moved to client approval.', stats: [['12', 'In progress'], ['4', 'Due soon'], ['91%', 'On time']], items: ['Maison Kanu identity · 88%', 'Nimba commercial · 64%', 'Kaloum launch · 42%'] },
  { key: 'production', label: 'Production', icon: Camera, person: 'Moussa', title: 'Track the shoot minute by minute', note: 'Call sheet ready. Departure in 45 minutes.', stats: [['09:30', 'Team call'], ['11:00', 'Shoot'], ['4 / 4', 'Equipment']], items: ['Pick up the Sony A7 IV', 'Go to Maison Kanu — Kipé', 'Upload footage before 6 PM'] },
  { key: 'editorial', label: 'Editorial', icon: Megaphone, person: 'Mariam', title: 'See the complete content strategy', note: '7 posts scheduled, 2 awaiting approval.', stats: [['18', 'Content items'], ['7', 'Scheduled'], ['92%', 'Pace']], items: ['Reel · Behind the shoot', 'Carousel · Offer of the month', 'LinkedIn · Kanu client story'] },
  { key: 'finance', label: 'Finance', icon: CircleDollarSign, person: 'Ibrahima', title: 'Keep cash flow under control', note: 'GNF 28.4 M remains to be collected on 7 invoices.', stats: [['7', 'To collect'], ['3', 'To approve'], ['92%', 'Up to date']], items: ['INV-0248 · GNF 12.4 M', 'INV-0251 · GNF 9.2 M', 'INV-0255 · GNF 6.8 M'] },
  { key: 'team', label: 'Team', icon: Users, person: 'Awa', title: 'Balance your entire team workload', note: 'Moussa becomes available tomorrow at 2 PM.', stats: [['14', 'Members'], ['8', 'Available'], ['82%', 'Capacity']], items: ['Production · 74% workload', 'Sales · 68% workload', 'Design · 91% workload'] },
  { key: 'ai', label: 'AI Copilot', icon: Bot, person: 'Awa', title: 'Turn data into decisions', note: 'The Kanu project margin can gain 8 points.', stats: [['3', 'Alerts'], ['6', 'Actions'], ['+18%', 'Potential']], items: ['Reduce one expense item', 'Move the Nimba follow-up forward', 'Optimize the studio schedule'] },
]

const plans = [
  { name: 'Essentiel', eyebrow: 'STRUCTURER', monthly: '300 000', annual: '3 240 000', copy: 'Pour centraliser les opérations d’une petite équipe.', users: 'Jusqu’à 5 utilisateurs', items: ['CRM clients & prospects', 'Projets, tâches et planning', 'Devis, factures et paiements', 'Documents et tableaux de bord'] },
  { name: 'Croissance', eyebrow: 'ACCÉLÉRER', monthly: '700 000', annual: '7 560 000', copy: 'Pour coordonner ventes, production et communication.', users: 'Jusqu’à 20 utilisateurs', items: ['Tout Essentiel', 'SMS, e-mail et campagnes', 'Portail client et validations', 'Production, éditorial, IA et automatisations'], featured: true },
  { name: 'Entreprise', eyebrow: 'DÉPLOYER', monthly: '1 000 000', annual: '10 800 000', copy: 'Pour les organisations exigeantes ou multi-équipes.', users: 'Jusqu’à 50 utilisateurs', items: ['Tout Croissance', 'Multi-espaces et droits avancés', 'Domaine, intégrations et quotas sur mesure', 'Accompagnement prioritaire'] },
]

const plansEn = [
  { name: 'Essential', eyebrow: 'ORGANIZE', monthly: '300,000', annual: '3,240,000', copy: 'For centralizing the operations of a small team.', users: 'Up to 5 users', items: ['Client & lead CRM', 'Projects, tasks and planning', 'Quotes, invoices and payments', 'Documents and dashboards'] },
  { name: 'Growth', eyebrow: 'ACCELERATE', monthly: '700,000', annual: '7,560,000', copy: 'For coordinating sales, production and communication.', users: 'Up to 20 users', items: ['Everything in Essential', 'SMS, email and campaigns', 'Client portal and approvals', 'Production, editorial, AI and automation'], featured: true },
  { name: 'Enterprise', eyebrow: 'SCALE', monthly: '1,000,000', annual: '10,800,000', copy: 'For demanding or multi-team organizations.', users: 'Up to 50 users', items: ['Everything in Growth', 'Multiple workspaces and advanced permissions', 'Custom domain, integrations and quotas', 'Priority support'] },
]

const heroPhrases: Record<Language, string[]> = {
  fr: ['vos projets.', 'votre comptabilité.', 'votre communication.', 'vos clients.', 'vos équipes.'],
  en: ['your projects.', 'your finances.', 'your communication.', 'your clients.', 'your team.'],
}

function RotatingHeadline({ language }: { language: Language }) {
  const phrases = heroPhrases[language]
  const [index, setIndex] = useState(0)
  const [length, setLength] = useState(phrases[0].length)
  const [deleting, setDeleting] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => { setIndex(0); setLength(heroPhrases[language][0].length); setDeleting(false) }, [language])
  useEffect(() => {
    if (reducedMotion) return
    const phrase = phrases[index]
    const delay = deleting ? (length === 0 ? 280 : 42) : (length === phrase.length ? 1900 : 70)
    const timeout = window.setTimeout(() => {
      if (!deleting && length === phrase.length) setDeleting(true)
      else if (deleting && length === 0) { setIndex((index + 1) % phrases.length); setDeleting(false) }
      else setLength(value => value + (deleting ? -1 : 1))
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [deleting, index, length, phrases, reducedMotion])

  const visible = reducedMotion ? phrases[0] : phrases[index].slice(0, length)
  return <h1 aria-label={language === 'en' ? 'One account to manage your projects, finances, communication, clients and team.' : 'Un seul compte pour piloter vos projets, votre comptabilité, votre communication, vos clients et vos équipes.'}>
    <span className="landing-hero-fixed">{language === 'en' ? 'One account to manage' : 'Un seul compte pour piloter'}</span>
    <span className={`landing-hero-rotator ${deleting ? 'is-deleting' : ''}`} aria-hidden="true"><em>{visible || '\u00a0'}</em></span>
  </h1>
}

function ProductPreview({ language }: { language: Language }) {
  const en = language === 'en'
  return <motion.div className="landing-product" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .15 }}>
    <div className="landing-product-top"><div className="landing-dots"><i/><i/><i/></div><span>{en ? 'Overview' : 'Vue d’ensemble'}</span><div className="landing-live"><i/> {en ? 'Activity synchronized' : 'Activité synchronisée'}</div></div>
    <div className="landing-product-shell">
      <aside><img src={companyProfile.logo_light} alt=""/><div className="landing-preview-nav"><b><BarChart3/> {en ? 'Overview' : 'Vue d’ensemble'}</b><span><BriefcaseBusiness/> {en ? 'Projects' : 'Projets'}</span><span><Users/> {en ? 'Clients' : 'Clients'}</span><span><FileCheck2/> {en ? 'Billing' : 'Facturation'}</span></div><div className="landing-preview-user"><i>AT</i><span><b>Awa Touré</b><small>{en ? 'Administrator' : 'Administratrice'}</small></span></div></aside>
      <div className="landing-preview-main">
        <header><div><small>{en ? 'FRIDAY, SEPTEMBER 26' : 'VENDREDI 26 SEPTEMBRE'}</small><strong>{en ? 'Hello, Awa.' : 'Bonjour, Awa.'}</strong></div><button aria-label={en ? 'New item' : 'Nouvel élément'}>+</button></header>
        <div className="landing-preview-kpis"><article className="highlight"><span>{en ? 'Revenue' : 'Chiffre d’affaires'}</span><strong>148.6 M</strong><small>GNF · {en ? 'this month' : 'ce mois'}</small></article><article><span>{en ? 'Active projects' : 'Projets actifs'}</span><strong>12</strong><small>{en ? '4 deliveries approaching' : '4 livraisons proches'}</small></article><article><span>{en ? 'To collect' : 'À encaisser'}</span><strong>28.4 M</strong><small>{en ? '7 open invoices' : '7 factures ouvertes'}</small></article></div>
        <div className="landing-preview-grid"><article className="landing-chart"><div><b>Performance</b><small>{en ? 'Last 6 months' : '6 derniers mois'}</small></div><div className="landing-bars">{[38, 52, 44, 68, 61, 86].map((height, index) => <i key={index} style={{ height: `${height}%` }}><span/></i>)}</div></article><article className="landing-tasks"><div><b>{en ? 'Priorities' : 'Priorités'}</b><small>{en ? 'View all' : 'Voir tout'}</small></div><p><i className="urgent"/><span><b>{en ? 'Approve campaign' : 'Valider la campagne'}</b><small>{en ? 'Today' : 'Aujourd’hui'} · 14:30</small></span></p><p><i/><span><b>{en ? 'Send the quote' : 'Envoyer le devis'}</b><small>Maison Kanu</small></span></p><p><i/><span><b>{en ? 'Prepare the shoot' : 'Préparer le tournage'}</b><small>{en ? 'Friday' : 'Vendredi'} · 09:00</small></span></p></article></div>
      </div>
    </div>
    <div className="preview-scan"/><div className="preview-cursor"><i/></div><div className="preview-toast"><Check/><span><b>{en ? 'Decision executed' : 'Décision exécutée'}</b><small>{en ? 'Kanu budget approved' : 'Budget Kanu validé'}</small></span></div>
  </motion.div>
}

function SceneContent({ scene, language }: { scene: typeof productScenes[number]; language: Language }) {
  const en = language === 'en'
  if (scene.key === 'editorial') return <div className="cinema-calendar"><div className="calendar-head"><b>{en ? 'Editorial calendar' : 'Calendrier éditorial'}</b><span>{en ? 'September 2026' : 'Septembre 2026'}</span><button>+ {en ? 'New content' : 'Nouveau contenu'}</button></div><div className="calendar-days">{(en ? ['MON 21', 'TUE 22', 'WED 23', 'THU 24', 'FRI 25'] : ['LUN 21', 'MAR 22', 'MER 23', 'JEU 24', 'VEN 25']).map((day, index) => <div key={day}><b>{day}</b>{index === 0 && <article className="post instagram"><small>INSTAGRAM · 09:00</small><strong>{en ? 'Kanu backstage' : 'Coulisses Kanu'}</strong><span>{en ? 'Client approved' : 'Validé client'}</span></article>}{index === 1 && <article className="post linkedin"><small>LINKEDIN · 11:30</small><strong>{en ? 'Nimba client story' : 'Cas client Nimba'}</strong><span>{en ? 'Scheduled' : 'Programmé'}</span></article>}{index === 2 && <article className="post facebook"><small>FACEBOOK · 15:00</small><strong>{en ? 'Offer of the month' : 'Offre du mois'}</strong><span>{en ? 'To approve' : 'À valider'}</span></article>}{index === 3 && <article className="post instagram"><small>REEL · 18:30</small><strong>{en ? 'Studio in motion' : 'Studio en mouvement'}</strong><span>{en ? 'Editing' : 'Montage'} 82%</span></article>}{index === 4 && <article className="post linkedin"><small>{en ? 'MULTICHANNEL' : 'MULTICANAL'} · 10:00</small><strong>Behind the brand</strong><span>{en ? 'Ready' : 'Prêt'}</span></article>}</div>)}</div></div>
  if (scene.key === 'production') return <div className="cinema-production"><div className="production-call"><span><Clock3/> {en ? 'TODAY · KANU SHOOT' : 'AUJOURD’HUI · TOURNAGE KANU'}</span><strong>Maison Kanu — Kipé</strong><small>{en ? 'Call sheet synchronized · 4 members confirmed' : 'Feuille de service synchronisée · 4 membres confirmés'}</small></div><div className="production-track">{(en ? [['08:45','Leave studio'],['09:30','Setup'],['11:00','Shoot'],['16:30','Backup']] : [['08:45','Départ studio'],['09:30','Installation'],['11:00','Tournage'],['16:30','Sauvegarde']]).map(([time, label], index) => <article key={time} className={index === 2 ? 'now' : ''}><i/><b>{time}</b><span>{label}</span></article>)}</div><div className="gear-row"><span><Camera/> Sony A7 IV <b>{en ? 'READY' : 'PRÊT'}</b></span><span><Zap/> {en ? 'Lighting' : 'Éclairage'} x3 <b>{en ? 'READY' : 'PRÊT'}</b></span><span><Users/> {en ? 'Team' : 'Équipe'} 4/4 <b>{en ? 'CONFIRMED' : 'CONFIRMÉE'}</b></span></div></div>
  if (scene.key === 'crm') return <div className="cinema-pipeline">{(en ? ['New', 'Proposal', 'Negotiation', 'Won'] : ['Nouveaux', 'Proposition', 'Négociation', 'Gagnés']).map((column, index) => <div key={column}><header><b>{column}</b><span>{[8,5,3,6][index]}</span></header><article style={{ '--delay': `${index * .14}s` } as CSSProperties}><strong>{scene.items[index % scene.items.length].split(' · ')[0]}</strong><small>{['18.5 M', '24 M', '32 M', '12 M'][index]} GNF</small><i><b style={{ width: `${45 + index * 15}%` }}/></i></article>{index < 3 && <article className="ghost-card"><strong>{['Soguipami','Kamsar Studio','Fouta Digital'][index]}</strong><small>{en ? 'Follow up' : 'À relancer'}</small></article>}</div>)}</div>
  return <div className="cinema-dashboard"><div className="role-ai-note"><Sparkles/><p><b>SmartSell Live</b><span>{scene.note}</span></p><small>{en ? 'Just now' : 'À l’instant'}</small></div><div className="role-stats">{scene.stats.map(([value, label], index) => <article key={label} className={index === 0 ? 'accent' : ''}><span>{label}</span><strong>{value}</strong><i style={{ '--progress': `${65 + index * 11}%` } as CSSProperties}/></article>)}</div><div className="cinema-lower"><article className="role-decision"><div><b>{scene.key === 'ai' ? (en ? 'Copilot recommendations' : 'Recommandations du copilote') : (en ? 'Actions in motion' : 'Actions en mouvement')}</b><small>{en ? 'Real time' : 'Temps réel'}</small></div>{scene.items.map((item, index) => <p key={item}><i>{index + 1}</i><span>{item}</span><button aria-label={`${en ? 'Open' : 'Ouvrir'} ${item}`}><ChevronRight/></button></p>)}</article><article className="role-activity"><b>{en ? 'Live activity' : 'Activité en direct'}</b><div className="mini-wave">{[35, 62, 48, 78, 58, 88, 72, 96, 68, 82].map((height, index) => <i key={index} style={{ height: `${height}%` }}/>)}</div><small>+18% {en ? 'this week' : 'cette semaine'}</small></article></div></div>
}

function ProductCinema({ language }: { language: Language }) {
  const en = language === 'en'
  const scenes = en ? productScenesEn : productScenes
  const [active, setActive] = useState(0)
  useEffect(() => { const timer = window.setInterval(() => setActive(value => (value + 1) % scenes.length), 5200); return () => window.clearInterval(timer) }, [scenes.length])
  const scene = scenes[active]
  const change = (direction: number) => setActive(value => (value + direction + scenes.length) % scenes.length)
  return <section className="landing-showcase" id="demo-produit">
    <div className="landing-showcase-head"><div><span className="landing-label">{en ? '8 SCREENS · ONE LIVING PLATFORM' : '8 ÉCRANS · UNE PLATEFORME VIVANTE'}</span><h2>{en ? <>Watch work flow<br/>in real time.</> : <>Regardez le travail<br/>circuler en temps réel.</>}</h2></div><p>{en ? 'Every scene is an animated demonstration: a manager makes decisions, a videographer follows the shoot and the editorial team orchestrates every post.' : 'Chaque scène est une démonstration animée : le manager décide, le vidéaste suit son tournage et l’équipe éditoriale orchestre chaque publication.'}</p></div>
    <div className="cinema-tabs" role="tablist" aria-label={en ? 'Platform screens' : 'Écrans de la plateforme'}>{scenes.map((item, index) => <button key={item.key} className={index === active ? 'active' : ''} onClick={() => setActive(index)} role="tab" aria-selected={index === active}><item.icon/><span>{item.label}</span>{index === active && <i/>}</button>)}</div>
    <div className="cinema-frame"><div className="cinema-ambient"/><div className="cinema-top"><span><i/><i/><i/></span><b>app.smartsell.management / {scene.key}</b><em><i/> LIVE</em></div><motion.div className="cinema-screen" key={`${language}-${scene.key}`} initial={{ opacity: 0, x: 32, filter: 'blur(8px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0)' }} transition={{ duration: .48 }}><aside><img src={companyProfile.logo_light} alt=""/><small>{en ? 'WORKSPACE' : 'ESPACE'} {scene.label.toUpperCase()}</small><strong>{en ? 'Hello' : 'Bonjour'}, {scene.person}.</strong><nav>{scenes.slice(0, 5).map((item, index) => <span className={item.key === scene.key ? 'active' : ''} key={item.key}><item.icon/>{item.label}{index === 4 && <b>7</b>}</span>)}</nav><div className="role-online"><i/> {en ? 'Everything is synchronized' : 'Tout est synchronisé'}</div></aside><main><header><div><small>{en ? 'YOUR LIVE WORKSPACE' : 'VOTRE ESPACE EN DIRECT'}</small><h3>{scene.title}</h3></div><button><Zap/> {en ? 'Quick action' : 'Action rapide'}</button></header><SceneContent scene={scene} language={language}/></main></motion.div><div className="cinema-scan"/><div className="cinema-pointer"><i/></div><div className="cinema-notification"><Sparkles/><span><b>{scene.label} {en ? 'updated' : 'mis à jour'}</b><small>{scene.note}</small></span></div><button className="cinema-arrow prev" onClick={() => change(-1)} aria-label={en ? 'Previous screen' : 'Écran précédent'}><ChevronLeft/></button><button className="cinema-arrow next" onClick={() => change(1)} aria-label={en ? 'Next screen' : 'Écran suivant'}><ChevronRight/></button><div className="cinema-counter"><b>0{active + 1}</b><span>/ 0{scenes.length}</span></div></div>
  </section>
}

function OperationsVisual({ onAction, language }: { onAction: () => void; language: Language }) {
  const en = language === 'en'
  return <div className="workflow-machine" aria-label="Flux animé des opérations">
    <div className="workflow-live"><i/> {en ? 'LIVE OPERATIONAL FLOW' : 'FLUX OPÉRATIONNEL EN DIRECT'} <span>{en ? '12 synchronized actions' : '12 actions synchronisées'}</span></div>
    <div className="workflow-stack"><article><div><b>01</b><Palette/></div><small>{en ? 'CONFIGURE' : 'CONFIGURER'}</small><strong>{en ? 'Your world' : 'Votre univers'}</strong><p>{en ? 'Brand, team, rules and documents become your SmartSell.' : 'Marque, équipe, règles et documents deviennent votre SmartSell.'}</p><span>{en ? 'Identity ready' : 'Identité prête'} <Check/></span></article><i className="flow-connector"><b/><b/></i><article><div><b>02</b><Zap/></div><small>{en ? 'COORDINATE' : 'COORDONNER'}</small><strong>{en ? 'Your operations' : 'Vos opérations'}</strong><p>{en ? 'Every action automatically flows between the right teams.' : 'Chaque action circule automatiquement entre les bons métiers.'}</p><span>{en ? '12 active flows' : '12 flux actifs'} <Check/></span></article><i className="flow-connector"><b/><b/></i><article><div><b>03</b><Gauge/></div><small>{en ? 'DECIDE' : 'DÉCIDER'}</small><strong>{en ? 'With clarity' : 'Avec clarté'}</strong><p>{en ? 'Alerts and AI turn activity into useful decisions.' : 'Les alertes et l’IA transforment l’activité en décisions utiles.'}</p><span>{en ? 'Briefing generated' : 'Briefing généré'} <Sparkles/></span></article></div>
    <div className="workflow-ticker"><Sparkles/><span>{en ? <>SmartSell just linked <b>a payment</b> to the <b>Maison Kanu</b> project and updated its margin.</> : <>SmartSell vient de relier <b>un paiement</b> au projet <b>Maison Kanu</b> et d’actualiser la marge.</>}</span><button onClick={onAction}>{en ? 'Explore' : 'Explorer'} <ArrowRight/></button></div>
  </div>
}

export default function LandingPage({ onOpenApp, onSignUp }: { onOpenApp: () => void; onSignUp: () => void }) {
  const pageRef = useRef<HTMLDivElement>(null)
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('smartsell-language') === 'en' ? 'en' : 'fr'))
  const [theme, setTheme] = useState<LandingTheme>(() => {
    const saved = localStorage.getItem('smartsell-landing-theme')
    return saved === 'light' || saved === 'dark' ? saved : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [demoOpen, setDemoOpen] = useState(false)
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [scrolled, setScrolled] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeSection, setActiveSection] = useState('accueil')
  const en = language === 'en'
  const localizedFeatures = en ? featuresEn : features
  const localizedPlans = en ? plansEn : plans

  useEffect(() => { const close = () => setMenuOpen(false); window.addEventListener('resize', close); return () => window.removeEventListener('resize', close) }, [])
  useEffect(() => { localStorage.setItem('smartsell-language', language); document.documentElement.lang = language }, [language])
  useEffect(() => { localStorage.setItem('smartsell-landing-theme', theme) }, [theme])
  useEffect(() => { document.body.style.overflow = selectedFeature || demoOpen ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [selectedFeature, demoOpen])
  useEffect(() => {
    const page = pageRef.current
    if (!page || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const selector = [
      '.landing-showcase-head h2', '.landing-showcase-head p',
      '.landing-trial-band h2', '.landing-trial-band p',
      '.landing-section-head > *', '.landing-feature-grid article > h3', '.landing-feature-grid article > p',
      '.landing-workflow-copy > .landing-label', '.landing-workflow-copy > h2', '.landing-workflow-copy > p',
      '.landing-steps strong', '.landing-steps p', '.brand-copy > .landing-label', '.brand-copy > h2', '.brand-copy > p',
      '.brand-list b', '.brand-list small', '.pricing-head > *', '.purchase-card h3', '.purchase-card p',
      '.subscription-heading h3', '.pricing-grid > article h3', '.pricing-grid > article p',
      '.landing-security h2', '.landing-security > p', '.landing-final > span', '.landing-final > h2', '.landing-final > p',
    ].join(',')
    const texts = [...page.querySelectorAll<HTMLElement>(selector)]
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' })
    texts.forEach((element, index) => {
      element.classList.add('landing-reveal-text')
      element.dataset.revealMode = index % 3 === 1 ? 'zoom' : 'rise'
      element.style.setProperty('--reveal-delay', `${(index % 3) * 55}ms`)
      observer.observe(element)
    })
    page.classList.add('motion-ready')
    return () => {
      observer.disconnect()
      page.classList.remove('motion-ready')
      texts.forEach(element => {
        element.classList.remove('landing-reveal-text', 'is-visible')
        delete element.dataset.revealMode
        element.style.removeProperty('--reveal-delay')
      })
    }
  }, [])
  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > 24)
      const available = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(available > 0 ? Math.min(100, (window.scrollY / available) * 100) : 0)
      const sections = ['accueil', 'demo-produit', 'solution', 'fonctionnement', 'personnalisation', 'tarifs']
      const current = sections.reduce((visible, id) => (document.getElementById(id)?.getBoundingClientRect().top ?? 9999) <= 180 ? id : visible, 'accueil')
      setActiveSection(current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  const go = (id: string) => { setMenuOpen(false); setActiveSection(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }
  const openDemo = () => setDemoOpen(true)
  const toggleLanguage = () => setLanguage(value => value === 'fr' ? 'en' : 'fr')
  const toggleTheme = () => setTheme(value => value === 'dark' ? 'light' : 'dark')
  const whatsappHref = `https://wa.me/224620619064?text=${encodeURIComponent(en ? 'Hello SmartSell, I would like to learn more about the solution and request a personalized demo.' : 'Bonjour SmartSell, je souhaite en savoir plus sur la solution et demander une démonstration personnalisée.')}`

  return <div ref={pageRef} className={`landing-page theme-${theme}`}>
    <header className={`landing-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="header-aurora"/><div className="header-grid"/>
      <a className="landing-brand" href="#accueil" onClick={() => setActiveSection('accueil')} aria-label={en ? 'SmartSell, home' : 'SmartSell, accueil'}><span className="brand-orbit"><i/><img src={theme === 'light' ? `${import.meta.env.BASE_URL}brand/wordmark-purple.png` : companyProfile.logo_light} alt="SmartSell"/></span><span>Management<small>BUSINESS OS</small></span></a>
      <nav className={menuOpen ? 'open' : ''} aria-label={en ? 'Main navigation' : 'Navigation principale'}>
        {(en ? [['solution', 'Features'], ['fonctionnement', 'How it works'], ['personnalisation', 'Customization'], ['tarifs', 'Pricing']] : [['solution', 'Fonctionnalités'], ['fonctionnement', 'Fonctionnement'], ['personnalisation', 'Personnalisation'], ['tarifs', 'Tarifs']]).map(([id, label]) => <button key={id} className={activeSection === id ? 'active' : ''} onClick={() => go(id)}><span>{label}</span><i/></button>)}
        <button className="mobile-signup" onClick={onSignUp}>{en ? 'Create an account · 72-hour trial' : 'Créer un compte · essai gratuit 72 h'}</button>
        <a href="#parrainage" onClick={()=>setMenuOpen(false)}>{en ? 'Referral program' : 'Parrainage · 10 % chacun'}</a>
        <button className="mobile-login" onClick={onOpenApp}>{en ? 'Already registered? Log in' : 'Déjà inscrit ? Se connecter'}</button>
      </nav>
      <div className="landing-header-actions"><div className="landing-preferences"><button onClick={toggleLanguage} aria-label={en ? 'Passer en français' : 'Switch to English'} title={en ? 'Français' : 'English'}><Globe2/><span>{en ? 'FR' : 'EN'}</span></button><button onClick={toggleTheme} aria-label={theme === 'dark' ? (en ? 'Enable light mode' : 'Activer le mode jour') : (en ? 'Enable dark mode' : 'Activer le mode nuit')} title={theme === 'dark' ? (en ? 'Light mode' : 'Mode jour') : (en ? 'Dark mode' : 'Mode nuit')}>{theme === 'dark' ? <Sun/> : <Moon/>}</button></div><a className="header-whatsapp" href={whatsappHref} target="_blank" rel="noreferrer" aria-label={en ? 'Chat on WhatsApp' : 'Discuter sur WhatsApp'}><MessageCircle/></a><button className="landing-login" onClick={onOpenApp}>{en ? 'Log in' : 'Se connecter'}</button><button className="landing-nav-cta" onClick={onSignUp}><span>{en ? 'Sign up' : 'S’inscrire'}</span><small>{en ? 'Free 72-hour trial' : 'Essai gratuit 72 h'}</small><ArrowRight/></button></div>
      <button className={`landing-menu ${menuOpen ? 'active' : ''}`} onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? (en ? 'Close menu' : 'Fermer le menu') : (en ? 'Open menu' : 'Ouvrir le menu')}>{menuOpen ? <X/> : <Menu/>}</button>
      <div className="header-progress" style={{ '--header-progress': `${scrollProgress}%` } as CSSProperties}/>
    </header>

    <main>
      <section className="landing-hero" id="accueil"><div className="landing-orb landing-orb-one"/><div className="landing-orb landing-orb-two"/><motion.div className="landing-hero-copy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}><div className="landing-kicker"><Sparkles/> {en ? 'Your entire company. One platform.' : 'Toute votre entreprise. Une seule plateforme.'}</div><RotatingHeadline language={language}/><p>{en ? 'SmartSell brings clients, projects, planning, production, teams, communication and finance together to turn every day into clear decisions.' : 'SmartSell réunit clients, projets, planning, production, équipe, communication et finances pour transformer chaque journée en décisions claires.'}</p><div className="landing-hero-actions"><button className="landing-primary" onClick={onSignUp}>{en ? 'Start my 72-hour demo' : 'Créer mon compte · essai gratuit 72 h'} <ArrowRight/></button><button className="landing-secondary" onClick={() => go('demo-produit')}><Play/> {en ? 'See the platform in action' : 'Voir la plateforme en action'}</button></div><p className="landing-existing">{en ? 'Already have an account?' : 'Vous avez déjà un compte ?'} <button onClick={onOpenApp}>{en ? 'Log in' : 'Se connecter'}</button></p><div className="landing-trust"><span><Check/> {en ? '100% tailored to your brand' : '100% à votre image'}</span><span><Check/> {en ? 'All your operations' : 'Toutes vos opérations'}</span><span><Check/> {en ? '72-hour trial access' : 'Accès d’essai limité à 72 h'}</span></div></motion.div><ProductPreview language={language}/><div className="landing-marquee"><span>CRM</span><i/><span>{en ? 'PROJECTS' : 'PROJETS'}</span><i/><span>{en ? 'PLANNING' : 'PLANNING'}</span><i/><span>{en ? 'PRODUCTION' : 'PRODUCTION'}</span><i/><span>{en ? 'BILLING' : 'FACTURATION'}</span><i/><span>HR</span><i/><span>AI</span></div></section>

      <ProductCinema language={language}/>

      <section className="landing-trial-band" aria-label={en ? 'Start your free trial' : 'Commencer votre essai gratuit'}><div><span>{en ? 'READY TO EXPLORE?' : 'PRÊT À ESSAYER ?'}</span><h2>{en ? 'Your own workspace is one step away.' : 'Votre propre espace est à un clic.'}</h2><p>{en ? 'Create an account and explore SmartSell free for 72 hours.' : 'Créez votre compte et découvrez SmartSell gratuitement pendant 72 heures.'}</p></div><div className="landing-trial-band-actions"><button className="landing-primary" onClick={onSignUp}>{en ? 'Create my free account' : 'Créer mon compte d’essai'} <ArrowRight/></button><button className="landing-trial-login" onClick={onOpenApp}>{en ? 'Already registered? Log in' : 'Déjà inscrit ? Se connecter'}</button></div></section>

      <section className="landing-features" id="solution"><div className="landing-section-head"><span>{en ? 'EVERYTHING IN ONE PLACE' : 'TOUT AU MÊME ENDROIT'}</span><h2>{en ? <>Fewer tools.<br/>More control.</> : <>Moins d’outils.<br/>Plus de maîtrise.</>}</h2><p>{en ? 'Twelve connected modules cover the complete journey: sell, produce, deliver, invoice, communicate and decide.' : 'Douze modules connectés couvrent le parcours complet : vendre, produire, livrer, facturer, communiquer et décider.'}</p></div><div className="landing-feature-grid expanded">{localizedFeatures.map((feature, index) => <motion.article key={feature.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: (index % 4) * .05 }}><div><span>{feature.number}</span><feature.icon/></div><h3>{feature.title}</h3><p>{feature.copy}</p><button onClick={() => setSelectedFeature(feature)}>{en ? 'Explore everything this module can do' : 'Voir tout ce que le module permet'} <ChevronRight/></button></motion.article>)}</div></section>

      <section className="landing-workflow" id="fonctionnement"><div className="landing-workflow-copy"><span className="landing-label">{en ? 'SIMPLE TO SET UP' : 'SIMPLE À METTRE EN PLACE'}</span><h2>{en ? 'Your company organized in three moves.' : 'Votre entreprise organisée en trois mouvements.'}</h2><p>{en ? 'SmartSell adapts to your methods, connects your teams and moves information toward the right decision.' : 'SmartSell reprend vos méthodes, connecte vos équipes et fait circuler l’information jusqu’à la bonne décision.'}</p><div className="landing-steps"><div><b>01</b><span><strong>{en ? 'We configure your world' : 'On configure votre univers'}</strong><p>{en ? 'Brand, team, roles, documents, services and business rules.' : 'Marque, équipe, rôles, documents, services et règles métier.'}</p></span></div><div><b>02</b><span><strong>{en ? 'Your operations come alive' : 'Vos opérations prennent vie'}</strong><p>{en ? 'Clients, projects, shoots, tasks and finance move together.' : 'Clients, projets, tournages, tâches et finances avancent ensemble.'}</p></span></div><div><b>03</b><span><strong>{en ? 'You manage with clarity' : 'Vous pilotez avec clarté'}</strong><p>{en ? 'Alerts, indicators and AI surface the decisions that matter.' : 'Alertes, indicateurs et IA font remonter les décisions utiles.'}</p></span></div></div></div><OperationsVisual onAction={openDemo} language={language}/></section>

      <section className="brand-section" id="personnalisation"><div className="brand-copy"><span className="landing-label">{en ? 'YOUR BRAND, NOT OURS' : 'VOTRE MARQUE, PAS LA NÔTRE'}</span><h2>{en ? '100% customized to your company.' : '100% personnalisée à l’image de votre entreprise.'}</h2><p>{en ? 'Your teams and clients use an application that truly looks and feels like your organization.' : 'Vos équipes et vos clients utilisent une application qui ressemble réellement à votre organisation.'}</p><div className="brand-list"><span><Palette/><b>{en ? 'Colors & fonts' : 'Couleurs & polices'}</b><small>{en ? 'Your visual identity everywhere.' : 'Votre charte graphique partout.'}</small></span><span><Sparkles/><b>{en ? 'Logo & identity' : 'Logo & identité'}</b><small>{en ? 'Your name, logo and visual world.' : 'Votre nom, votre logo, votre univers.'}</small></span><span><FileCheck2/><b>{en ? 'Invoices & documents' : 'Factures & documents'}</b><small>{en ? 'Professional templates in your image.' : 'Des modèles professionnels à votre image.'}</small></span><span><Settings2/><b>{en ? 'Modules & processes' : 'Modules & processus'}</b><small>{en ? 'The right screens for your business.' : 'Les bons écrans pour vos métiers.'}</small></span></div></div><div className="brand-studio"><div className="brand-controls"><span>{en ? 'BRAND STUDIO' : 'STUDIO DE MARQUE'}</span><p><i className="purple"/><i className="yellow"/><i className="blue"/><b>SmartSell Studio</b></p><label>{en ? 'TYPOGRAPHY' : 'TYPOGRAPHIE'} <strong>Montserrat</strong></label><label>LOGO <strong>{en ? 'Your company' : 'Votre entreprise'}</strong></label><label>{en ? 'DOCUMENTS' : 'DOCUMENTS'} <strong>{en ? 'Invoices · Quotes · Receipts' : 'Factures · Devis · Reçus'}</strong></label></div><div className="brand-document"><header><div className="brand-logo-demo">V</div><span><b>{en ? 'YOUR COMPANY' : 'VOTRE ENTREPRISE'}</b><small>{en ? 'CUSTOM INVOICE' : 'FACTURE PERSONNALISÉE'}</small></span><em>{en ? 'PAID' : 'PAYÉE'}</em></header><div className="invoice-lines"><i/><i/><i/><i/></div><footer><span>Total</span><strong>18 200 000 GNF</strong></footer></div><span className="brand-domain">app.yourcompany.com</span></div></section>

      <section className="pricing-section" id="tarifs">
        <div className="pricing-head"><span className="landing-label">{en ? 'CLEAR PRICING FOR A COMPLETE PLATFORM' : 'DES PRIX CLAIRS, POUR UNE PLATEFORME COMPLÈTE'}</span><h2>{en ? <>Buy the solution.<br/>Or grow with a subscription.</> : <>Achetez la solution.<br/>Ou avancez par abonnement.</>}</h2><p>{en ? 'Accessible pricing for a complete, customized and supported management platform.' : 'Des tarifs accessibles pour une plateforme de gestion complète, personnalisée et accompagnée.'}</p></div>
        <article className="purchase-card"><div><span>{en ? 'OPTION 01 · PURCHASE' : 'OPTION 01 · ACHAT'}</span><h3>{en ? 'Your solution, permanently.' : 'Votre solution, définitivement.'}</h3><p>{en ? 'Perpetual license, deployment and complete adaptation to your operations.' : 'Licence perpétuelle, déploiement et adaptation complète à vos opérations.'}</p></div><div className="purchase-items"><span><Check/> {en ? 'Installation and setup' : 'Installation et configuration'}</span><span><Check/> {en ? 'Complete customization' : 'Personnalisation complète'}</span><span><Check/> {en ? 'Team training' : 'Formation de votre équipe'}</span><span><Check/> {en ? 'Optional maintenance' : 'Maintenance disponible en option'}</span></div><div className="purchase-price"><small>{en ? 'CUSTOM PROJECT' : 'PROJET SUR MESURE'}</small><strong>{en ? 'On request' : 'Sur devis'}</strong><a className="whatsapp-quote" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle/> {en ? 'Request via WhatsApp' : 'Demander sur WhatsApp'}</a></div></article>
        <div className="subscription-heading"><div><span>{en ? 'OPTION 02 · SUBSCRIPTION' : 'OPTION 02 · ABONNEMENT'}</span><h3>{en ? 'A plan that grows with you.' : 'Une formule qui évolue avec vous.'}</h3></div><div className="billing-toggle" aria-label={en ? 'Billing period' : 'Période de facturation'}><button className={billing === 'monthly' ? 'active' : ''} onClick={() => setBilling('monthly')}>{en ? 'Monthly' : 'Mensuel'}</button><button className={billing === 'annual' ? 'active' : ''} onClick={() => setBilling('annual')}>{en ? 'Annual' : 'Annuel'} <span>−10%</span></button></div></div>
        <div className="pricing-grid">{localizedPlans.map(plan => <article key={plan.name} className={plan.featured ? 'featured' : ''}>{plan.featured && <span className="popular">{en ? 'MOST POPULAR' : 'LE PLUS CHOISI'}</span>}<small>{plan.eyebrow}</small><h3>{plan.name}</h3><p>{plan.copy}</p><div className="plan-price"><strong>{billing === 'monthly' ? plan.monthly : plan.annual}</strong><span>GNF / {billing === 'monthly' ? (en ? 'month' : 'mois') : (en ? 'year' : 'an')}</span></div>{billing === 'annual' && <em className="annual-saving">{en ? '10% discount' : '10 % de réduction'}</em>}<b className="plan-users">{plan.users}</b><ul>{plan.items.map(item => <li key={item}><Check/>{item}</li>)}</ul><button onClick={plan.featured ? onSignUp : openDemo}>{plan.featured ? (en ? 'Try for 72 hours' : 'Tester pendant 72 h') : (en ? 'Choose this plan' : 'Choisir cette offre')} <ArrowRight/></button></article>)}</div>
        <p className="trial-note"><ShieldCheck/> {en ? 'The demo lasts 72 hours. Your data remains visible afterwards, while paid actions require a subscription.' : 'La démo dure 72 heures. Ensuite, vos données restent visibles ; les actions payantes nécessitent un abonnement.'}</p>
      </section>

      <section className="landing-security" id="securite"><div className="landing-security-icon"><ShieldCheck/></div><div><span>{en ? 'SECURE BY DESIGN' : 'SÉCURITÉ PAR CONCEPTION'}</span><h2>{en ? 'The right information, for the right people.' : 'Les bonnes informations, aux bonnes personnes.'}</h2></div><p>{en ? 'Precise roles, action history and separate workspaces let your organization grow without losing control.' : 'Des rôles précis, un historique des actions et des espaces séparés permettent à votre organisation de grandir sans perdre le contrôle.'}</p><div className="landing-security-tags"><span>{en ? 'Role-based access' : 'Accès par rôle'}</span><span>{en ? 'Activity log' : 'Journal d’activité'}</span><span>{en ? 'Isolated workspaces' : 'Espaces isolés'}</span><span>{en ? 'Temporary accounts' : 'Comptes temporaires'}</span></div></section>

      <section className="landing-final"><div className="landing-final-mark">S</div><span>{en ? '72 HOURS TO SEE THE DIFFERENCE' : '72 HEURES POUR VOIR LA DIFFÉRENCE'}</span><h2>{en ? <>Your company.<br/><em>Finally, in one place.</em></> : <>Votre entreprise.<br/><em>Enfin, au même endroit.</em></>}</h2><p>{en ? 'Discover a living, customized platform ready to support every team.' : 'Découvrez une plateforme vivante, personnalisée et prête à accompagner chaque métier.'}</p><div className="landing-final-actions"><button className="landing-primary" onClick={onSignUp}>{en ? 'Try the application · 72 hours' : 'Tester l’application · 72 h'} <ArrowRight/></button><button className="landing-trial-login" onClick={onOpenApp}>{en ? 'Already have an account? Log in' : 'Déjà inscrit ? Se connecter'}</button><a href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle/> {en ? 'Talk to an advisor' : 'Parler à un conseiller'}</a></div></section>
    </main>

    <footer className="landing-footer">
      <div className="footer-aurora"/><div className="footer-grid"/>
      <a className="footer-bar-brand" href="#accueil" onClick={() => go('accueil')}><span><i/><img src={theme === 'light' ? `${import.meta.env.BASE_URL}brand/wordmark-purple.png` : companyProfile.logo_light} alt="SmartSell"/></span><small>© {new Date().getFullYear()} · MANAGEMENT</small></a>
      <nav className="footer-bar-nav" aria-label={en ? 'Footer navigation' : 'Navigation du pied de page'}><button onClick={() => go('solution')}>{en ? 'Features' : 'Fonctionnalités'}</button><button onClick={() => go('personnalisation')}>{en ? 'Customization' : 'Personnalisation'}</button><button onClick={() => go('tarifs')}>{en ? 'Pricing' : 'Tarifs'}</button><a href="#parrainage">{en ? 'Referral program' : 'Parrainage'}</a><a href="#privacy">{en ? 'Privacy' : 'Confidentialité'}</a></nav>
      <div className="footer-bar-actions"><button className="footer-auth" onClick={onOpenApp}>{en ? 'Log in' : 'Se connecter'}</button><button className="footer-auth footer-signup" onClick={onSignUp}>{en ? 'Free trial' : 'Essai gratuit 72 h'}</button><span className="footer-status"><i/> {en ? 'Systems operational' : 'Systèmes opérationnels'}</span><a href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle/> WhatsApp</a><button onClick={() => go('accueil')} aria-label={en ? 'Back to top' : 'Retour en haut'}><ArrowUp/></button></div>
    </footer>

    <a className="floating-whatsapp" href={whatsappHref} target="_blank" rel="noreferrer" aria-label={en ? 'Contact SmartSell on WhatsApp' : 'Contacter SmartSell sur WhatsApp'}><span><i/></span><MessageCircle/><b>{en ? 'Let’s talk' : 'Discutons'}</b><small>{en ? 'Usually replies quickly' : 'Réponse rapide'}</small></a>

    {selectedFeature && <div className="landing-modal-backdrop" role="presentation" onMouseDown={() => setSelectedFeature(null)}><motion.div className="landing-demo-modal feature-modal" role="dialog" aria-modal="true" aria-labelledby="feature-title" initial={{ opacity: 0, scale: .96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedFeature(null)} aria-label={en ? 'Close' : 'Fermer'}><X/></button><span className="modal-number">MODULE {selectedFeature.number}</span><selectedFeature.icon/><h2 id="feature-title">{selectedFeature.title}</h2><p>{selectedFeature.copy}</p><ul>{selectedFeature.details.map(detail => <li key={detail}><Check/>{detail}</li>)}</ul><button className="landing-primary" onClick={() => { setSelectedFeature(null); onSignUp() }}>{en ? 'Try this module for 72 hours' : 'Tester ce module pendant 72 h'} <ArrowRight/></button></motion.div></div>}

    {demoOpen && <div className="landing-modal-backdrop" role="presentation" onMouseDown={() => setDemoOpen(false)}><motion.div className="landing-demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-title" initial={{ opacity: 0, scale: .96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={() => setDemoOpen(false)} aria-label={en ? 'Close' : 'Fermer'}><X/></button><div className="demo-icon"><Play/></div><span>{en ? 'PERSONALIZED DEMO' : 'DÉMO PERSONNALISÉE'}</span><h2 id="demo-title">{en ? 'Try SmartSell for 72 hours.' : 'Testez SmartSell pendant 72 heures.'}</h2><p>{en ? 'Create your account with Google or email. After 72 hours, access is automatically suspended until payment.' : 'Créez votre compte par Google ou par e-mail. Après 72 heures, l’accès est automatiquement suspendu jusqu’au paiement.'}</p><div className="demo-points"><span><Check/> {en ? 'Access to key modules' : 'Accès aux modules clés'}</span><span><Check/> {en ? 'Explore with your team' : 'Découverte avec votre équipe'}</span><span><Check/> {en ? 'No commitment before payment' : 'Sans engagement avant paiement'}</span></div><button className="landing-primary" onClick={onSignUp}><Mail/> {en ? 'Create my 72-hour access' : 'Créer mon accès 72 h'}</button><button className="existing-access" onClick={onOpenApp}>{en ? 'I already have an account' : 'J’ai déjà un compte'} <ArrowRight/></button><small>{en ? 'A confirmation email secures your workspace activation.' : 'Un e-mail de confirmation sécurise l’ouverture de votre espace.'}</small></motion.div></div>}
  </div>
}
