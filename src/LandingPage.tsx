import { type CSSProperties, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight, BarChart3, BriefcaseBusiness, CalendarDays, Camera, Check,
  ChevronRight, CircleDollarSign, FileCheck2, Gauge, Layers3, Mail, Menu,
  MessageSquareText, PackageCheck, Palette, Play, Settings2, ShieldCheck,
  Sparkles, Users, WandSparkles, X, Zap,
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

const roles = [
  { key: 'manager', label: 'Manager', person: 'Awa', title: 'Décider avec une vue complète', note: 'SmartSell a détecté 3 décisions prioritaires aujourd’hui.', stats: [['148,6 M', 'CA ce mois'], ['12', 'Projets actifs'], ['86%', 'Objectifs']], items: ['Valider le budget de la campagne Kanu', 'Réaffecter une équipe disponible', 'Relancer 3 factures échues'] },
  { key: 'video', label: 'Vidéaste', person: 'Moussa', title: 'Suivre le planning du tournage', note: 'Votre feuille de service est prête. Départ prévu dans 45 min.', stats: [['09:30', 'Appel équipe'], ['11:00', 'Tournage'], ['4 / 4', 'Équipements']], items: ['Récupérer caméra Sony A7 IV', 'Rejoindre Maison Kanu — Kipé', 'Déposer les rushes avant 18:00'] },
  { key: 'sales', label: 'Commerciale', person: 'Fatou', title: 'Faire avancer les opportunités', note: 'Deux prospects chauds attendent une proposition aujourd’hui.', stats: [['24', 'Prospects'], ['8', 'Propositions'], ['64%', 'Conversion']], items: ['Appeler Groupe Nimba à 10:00', 'Envoyer le devis Kaloum Tech', 'Préparer la démonstration de 15:30'] },
  { key: 'finance', label: 'Comptable', person: 'Ibrahima', title: 'Garder la trésorerie sous contrôle', note: '28,4 M GNF restent à encaisser sur 7 factures.', stats: [['7', 'À encaisser'], ['3', 'Dépenses à valider'], ['92%', 'À jour']], items: ['Relancer la facture FAC-0248', 'Valider deux justificatifs', 'Clôturer le rapport hebdomadaire'] },
]

const plans = [
  { name: 'Essentiel', eyebrow: 'STRUCTURER', copy: 'Pour centraliser les opérations d’une petite équipe.', users: 'Jusqu’à 5 utilisateurs', items: ['CRM clients & prospects', 'Projets, tâches et planning', 'Devis, factures et paiements', 'Documents et tableaux de bord'] },
  { name: 'Croissance', eyebrow: 'ACCÉLÉRER', copy: 'Pour coordonner ventes, production et communication.', users: 'Jusqu’à 20 utilisateurs', items: ['Tout Essentiel', 'SMS, e-mail et campagnes', 'Portail client et validations', 'Production, éditorial, IA et automatisations'], featured: true },
  { name: 'Entreprise', eyebrow: 'DÉPLOYER', copy: 'Pour les organisations exigeantes ou multi-équipes.', users: 'Utilisateurs flexibles', items: ['Tout Croissance', 'Multi-espaces et droits avancés', 'Domaine, intégrations et quotas sur mesure', 'Accompagnement prioritaire'] },
]

function ProductPreview() {
  return <motion.div className="landing-product" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .15 }}>
    <div className="landing-product-top"><div className="landing-dots"><i/><i/><i/></div><span>Vue d’ensemble</span><div className="landing-live"><i/> Activité synchronisée</div></div>
    <div className="landing-product-shell">
      <aside><img src={companyProfile.logo_light} alt=""/><div className="landing-preview-nav"><b><BarChart3/> Vue d’ensemble</b><span><BriefcaseBusiness/> Projets</span><span><Users/> Clients</span><span><FileCheck2/> Facturation</span></div><div className="landing-preview-user"><i>AT</i><span><b>Awa Touré</b><small>Administratrice</small></span></div></aside>
      <div className="landing-preview-main">
        <header><div><small>VENDREDI 26 SEPTEMBRE</small><strong>Bonjour, Awa.</strong></div><button aria-label="Nouvel élément">+</button></header>
        <div className="landing-preview-kpis"><article className="highlight"><span>Chiffre d’affaires</span><strong>148,6 M</strong><small>GNF · ce mois</small></article><article><span>Projets actifs</span><strong>12</strong><small>4 livraisons proches</small></article><article><span>À encaisser</span><strong>28,4 M</strong><small>7 factures ouvertes</small></article></div>
        <div className="landing-preview-grid"><article className="landing-chart"><div><b>Performance</b><small>6 derniers mois</small></div><div className="landing-bars">{[38, 52, 44, 68, 61, 86].map((height, index) => <i key={index} style={{ height: `${height}%` }}><span/></i>)}</div></article><article className="landing-tasks"><div><b>Priorités</b><small>Voir tout</small></div><p><i className="urgent"/><span><b>Valider la campagne</b><small>Aujourd’hui · 14:30</small></span></p><p><i/><span><b>Envoyer le devis</b><small>Maison Kanu</small></span></p><p><i/><span><b>Préparer le tournage</b><small>Vendredi · 09:00</small></span></p></article></div>
      </div>
    </div>
  </motion.div>
}

function RoleShowcase() {
  const [active, setActive] = useState(0)
  useEffect(() => { const timer = window.setInterval(() => setActive(value => (value + 1) % roles.length), 6500); return () => window.clearInterval(timer) }, [])
  const role = roles[active]
  return <section className="landing-showcase" id="demo-produit">
    <div className="landing-showcase-head"><div><span className="landing-label">UNE PLATEFORME, PLUSIEURS MÉTIERS</span><h2>Chacun voit ce qu’il doit faire.<br/>Le manager voit où aller.</h2></div><p>Choisissez un rôle pour découvrir comment SmartSell transforme une journée de travail en actions simples et coordonnées.</p></div>
    <div className="role-tabs" role="tablist" aria-label="Scènes par métier">{roles.map((item, index) => <button key={item.key} className={index === active ? 'active' : ''} onClick={() => setActive(index)} role="tab" aria-selected={index === active}><span>{item.person.slice(0, 1)}</span>{item.label}</button>)}</div>
    <motion.div className="role-screen" key={role.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <aside><img src={companyProfile.logo_light} alt=""/><small>ESPACE DE {role.label.toUpperCase()}</small><strong>Bonjour, {role.person}.</strong><nav><b><Gauge/> Aujourd’hui</b><span><CalendarDays/> Mon planning</span><span><BriefcaseBusiness/> Mes missions</span><span><MessageSquareText/> Messages</span></nav><div className="role-online"><i/> Synchronisé à l’instant</div></aside>
      <main><header><div><small>VOTRE JOURNÉE</small><h3>{role.title}</h3></div><button><Zap/> Action rapide</button></header><div className="role-ai-note"><Sparkles/><p><b>Briefing SmartSell</b><span>{role.note}</span></p><small>Mis à jour</small></div><div className="role-stats">{role.stats.map(([value, label], index) => <article key={label} className={index === 0 ? 'accent' : ''}><span>{label}</span><strong>{value}</strong><i style={{ '--progress': `${65 + index * 11}%` } as CSSProperties}/></article>)}</div><div className="role-lower"><article className="role-decision"><div><b>Priorités recommandées</b><small>3 actions</small></div>{role.items.map((item, index) => <p key={item}><i>{index + 1}</i><span>{item}</span><button aria-label={`Ouvrir ${item}`}><ChevronRight/></button></p>)}</article><article className="role-activity"><b>Activité en direct</b><div className="mini-wave">{[35, 62, 48, 78, 58, 88, 72, 96, 68, 82].map((height, index) => <i key={index} style={{ height: `${height}%` }}/>)}</div><small>+18% cette semaine</small></article></div></main>
    </motion.div>
  </section>
}

function OperationsVisual({ onAction }: { onAction: () => void }) {
  return <div className="operations-3d" aria-label="Visualisation animée des opérations">
    <div className="orbit orbit-one"><span className="orbit-node node-project"><BriefcaseBusiness/><b>Projet lancé</b><small>Campagne Kanu</small></span></div>
    <div className="orbit orbit-two"><span className="orbit-node node-team"><Users/><b>Équipe assignée</b><small>4 collaborateurs</small></span></div>
    <div className="orbit orbit-three"><span className="orbit-node node-paid"><CircleDollarSign/><b>Paiement reçu</b><small>18,2 M GNF</small></span></div>
    <div className="orbit-core-3d"><span><Zap/></span><small>SMARTSELL</small><strong>Votre activité<br/>en mouvement</strong><button onClick={onAction}>Voir la démo <ArrowRight/></button></div>
    <i className="data-pulse pulse-a"/><i className="data-pulse pulse-b"/><i className="data-pulse pulse-c"/>
  </div>
}

export default function LandingPage({ onOpenApp, onSignUp }: { onOpenApp: () => void; onSignUp: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [demoOpen, setDemoOpen] = useState(false)
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')

  useEffect(() => { const close = () => setMenuOpen(false); window.addEventListener('resize', close); return () => window.removeEventListener('resize', close) }, [])
  useEffect(() => { document.body.style.overflow = selectedFeature || demoOpen ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [selectedFeature, demoOpen])
  const go = (id: string) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }
  const openDemo = () => setDemoOpen(true)

  return <div className="landing-page">
    <header className="landing-header"><a className="landing-brand" href="#accueil" aria-label="SmartSell, accueil"><img src={companyProfile.logo_light} alt="SmartSell"/><span>Management</span></a><nav className={menuOpen ? 'open' : ''} aria-label="Navigation principale"><button onClick={() => go('solution')}>Fonctionnalités</button><button onClick={() => go('fonctionnement')}>Fonctionnement</button><button onClick={() => go('personnalisation')}>Personnalisation</button><button onClick={() => go('tarifs')}>Tarifs</button></nav><div className="landing-header-actions"><button className="landing-login" onClick={onOpenApp}>Se connecter</button><button className="landing-nav-cta" onClick={openDemo}>Tester 72 h <ArrowRight/></button></div><button className="landing-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}>{menuOpen ? <X/> : <Menu/>}</button></header>

    <main>
      <section className="landing-hero" id="accueil"><div className="landing-orb landing-orb-one"/><div className="landing-orb landing-orb-two"/><motion.div className="landing-hero-copy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}><div className="landing-kicker"><Sparkles/> Toute votre entreprise. Une seule plateforme.</div><h1>Un seul espace.<br/><em>Toute votre activité.</em></h1><p>SmartSell réunit clients, projets, planning, production, équipe, communication et finances pour transformer chaque journée en décisions claires.</p><div className="landing-hero-actions"><button className="landing-primary" onClick={onSignUp}>Créer ma démo · 72 h <ArrowRight/></button><button className="landing-secondary" onClick={() => go('demo-produit')}><Play/> Voir la plateforme en action</button></div><div className="landing-trust"><span><Check/> 100% à votre image</span><span><Check/> Toutes vos opérations</span><span><Check/> Accès d’essai limité à 72 h</span></div></motion.div><ProductPreview/><div className="landing-marquee"><span>CRM</span><i/><span>PROJETS</span><i/><span>PLANNING</span><i/><span>PRODUCTION</span><i/><span>FACTURATION</span><i/><span>RH</span><i/><span>IA</span></div></section>

      <RoleShowcase/>

      <section className="landing-features" id="solution"><div className="landing-section-head"><span>TOUT AU MÊME ENDROIT</span><h2>Moins d’outils.<br/>Plus de maîtrise.</h2><p>Douze modules connectés couvrent le parcours complet : vendre, produire, livrer, facturer, communiquer et décider.</p></div><div className="landing-feature-grid expanded">{features.map((feature, index) => <motion.article key={feature.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: (index % 4) * .05 }}><div><span>{feature.number}</span><feature.icon/></div><h3>{feature.title}</h3><p>{feature.copy}</p><button onClick={() => setSelectedFeature(feature)}>Voir tout ce que le module permet <ChevronRight/></button></motion.article>)}</div></section>

      <section className="landing-workflow" id="fonctionnement"><div className="landing-workflow-copy"><span className="landing-label">SIMPLE À METTRE EN PLACE</span><h2>Votre entreprise organisée en trois mouvements.</h2><p>SmartSell reprend vos méthodes, connecte vos équipes et fait circuler l’information jusqu’à la bonne décision.</p><div className="landing-steps"><div><b>01</b><span><strong>On configure votre univers</strong><p>Marque, équipe, rôles, documents, services et règles métier.</p></span></div><div><b>02</b><span><strong>Vos opérations prennent vie</strong><p>Clients, projets, tournages, tâches et finances avancent ensemble.</p></span></div><div><b>03</b><span><strong>Vous pilotez avec clarté</strong><p>Alertes, indicateurs et IA font remonter les décisions utiles.</p></span></div></div></div><OperationsVisual onAction={openDemo}/></section>

      <section className="brand-section" id="personnalisation"><div className="brand-copy"><span className="landing-label">VOTRE MARQUE, PAS LA NÔTRE</span><h2>100% personnalisée à l’image de votre entreprise.</h2><p>Vos équipes et vos clients utilisent une application qui ressemble réellement à votre organisation.</p><div className="brand-list"><span><Palette/><b>Couleurs & polices</b><small>Votre charte graphique partout.</small></span><span><Sparkles/><b>Logo & identité</b><small>Votre nom, votre logo, votre univers.</small></span><span><FileCheck2/><b>Factures & documents</b><small>Des modèles professionnels à votre image.</small></span><span><Settings2/><b>Modules & processus</b><small>Les bons écrans pour vos métiers.</small></span></div></div><div className="brand-studio"><div className="brand-controls"><span>STUDIO DE MARQUE</span><p><i className="purple"/><i className="yellow"/><i className="blue"/><b>SmartSell Studio</b></p><label>TYPOGRAPHIE <strong>Montserrat</strong></label><label>LOGO <strong>Votre entreprise</strong></label><label>DOCUMENTS <strong>Factures · Devis · Reçus</strong></label></div><div className="brand-document"><header><div className="brand-logo-demo">V</div><span><b>VOTRE ENTREPRISE</b><small>FACTURE PERSONNALISÉE</small></span><em>PAYÉE</em></header><div className="invoice-lines"><i/><i/><i/><i/></div><footer><span>Total</span><strong>18 200 000 GNF</strong></footer></div><span className="brand-domain">app.votreentreprise.com</span></div></section>

      <section className="pricing-section" id="tarifs"><div className="pricing-head"><span className="landing-label">UNE FORMULE ADAPTÉE À VOTRE STRATÉGIE</span><h2>Achetez la solution.<br/>Ou avancez par abonnement.</h2><p>Dans les deux cas, votre plateforme est configurée et personnalisée pour votre entreprise.</p></div><article className="purchase-card"><div><span>OPTION 01 · ACHAT</span><h3>Votre solution, définitivement.</h3><p>Vous achetez une licence perpétuelle de SmartSell adaptée à vos opérations.</p></div><div className="purchase-items"><span><Check/> Installation et configuration</span><span><Check/> Personnalisation complète</span><span><Check/> Formation de votre équipe</span><span><Check/> Maintenance disponible en option</span></div><div className="purchase-price"><small>INVESTISSEMENT UNIQUE</small><strong>Sur devis</strong><button onClick={openDemo}>Étudier mon projet <ArrowRight/></button></div></article><div className="subscription-heading"><div><span>OPTION 02 · ABONNEMENT</span><h3>Une formule qui évolue avec vous.</h3></div><div className="billing-toggle" aria-label="Période de facturation"><button className={billing === 'monthly' ? 'active' : ''} onClick={() => setBilling('monthly')}>Mensuel</button><button className={billing === 'annual' ? 'active' : ''} onClick={() => setBilling('annual')}>Annuel</button></div></div><div className="pricing-grid">{plans.map(plan => <article key={plan.name} className={plan.featured ? 'featured' : ''}>{plan.featured && <span className="popular">LE PLUS COMPLET</span>}<small>{plan.eyebrow}</small><h3>{plan.name}</h3><p>{plan.copy}</p><div className="plan-price"><strong>Sur devis</strong><span>/ {billing === 'monthly' ? 'mois' : 'an'}</span></div><b className="plan-users">{plan.users}</b><ul>{plan.items.map(item => <li key={item}><Check/>{item}</li>)}</ul><button onClick={openDemo}>{plan.featured ? 'Tester pendant 72 h' : 'Choisir cette offre'} <ArrowRight/></button></article>)}</div><p className="trial-note"><ShieldCheck/> La démo dure 72 heures. À son terme, l’accès est suspendu jusqu’à l’achat de la solution ou l’activation d’un abonnement.</p></section>

      <section className="landing-security" id="securite"><div className="landing-security-icon"><ShieldCheck/></div><div><span>SÉCURITÉ PAR CONCEPTION</span><h2>Les bonnes informations, aux bonnes personnes.</h2></div><p>Des rôles précis, un historique des actions et des espaces séparés permettent à votre organisation de grandir sans perdre le contrôle.</p><div className="landing-security-tags"><span>Accès par rôle</span><span>Journal d’activité</span><span>Espaces isolés</span><span>Comptes temporaires</span></div></section>

      <section className="landing-final"><div className="landing-final-mark">S</div><span>72 HEURES POUR VOIR LA DIFFÉRENCE</span><h2>Votre entreprise.<br/><em>Enfin, au même endroit.</em></h2><p>Découvrez une plateforme vivante, personnalisée et prête à accompagner chaque métier.</p><button className="landing-primary" onClick={openDemo}>Tester l’application · 72 h <ArrowRight/></button></section>
    </main>

    <footer className="landing-footer"><div><img src={companyProfile.logo_light} alt="SmartSell"/><p>La plateforme de gestion personnalisée pour les équipes qui veulent avancer avec clarté.</p></div><div><strong>Produit</strong><button onClick={() => go('solution')}>Fonctionnalités</button><button onClick={() => go('personnalisation')}>Personnalisation</button><button onClick={() => go('tarifs')}>Tarifs</button></div><div><strong>Contact</strong><a href={`mailto:${companyProfile.email}`}>{companyProfile.email}</a><a href={`tel:${companyProfile.phone.replaceAll(' ', '')}`}>{companyProfile.phone}</a><span>{companyProfile.address}</span></div><small>© {new Date().getFullYear()} SmartSell. Tous droits réservés.</small></footer>

    {selectedFeature && <div className="landing-modal-backdrop" role="presentation" onMouseDown={() => setSelectedFeature(null)}><motion.div className="landing-demo-modal feature-modal" role="dialog" aria-modal="true" aria-labelledby="feature-title" initial={{ opacity: 0, scale: .96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedFeature(null)} aria-label="Fermer"><X/></button><span className="modal-number">MODULE {selectedFeature.number}</span><selectedFeature.icon/><h2 id="feature-title">{selectedFeature.title}</h2><p>{selectedFeature.copy}</p><ul>{selectedFeature.details.map(detail => <li key={detail}><Check/>{detail}</li>)}</ul><button className="landing-primary" onClick={() => { setSelectedFeature(null); openDemo() }}>Tester ce module pendant 72 h <ArrowRight/></button></motion.div></div>}

    {demoOpen && <div className="landing-modal-backdrop" role="presentation" onMouseDown={() => setDemoOpen(false)}><motion.div className="landing-demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-title" initial={{ opacity: 0, scale: .96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={() => setDemoOpen(false)} aria-label="Fermer"><X/></button><div className="demo-icon"><Play/></div><span>DÉMO PERSONNALISÉE</span><h2 id="demo-title">Testez SmartSell pendant 72 heures.</h2><p>Créez votre compte par Google ou par e-mail. Après 72 heures, l’accès est automatiquement suspendu jusqu’au paiement.</p><div className="demo-points"><span><Check/> Accès aux modules clés</span><span><Check/> Découverte avec votre équipe</span><span><Check/> Sans engagement avant paiement</span></div><button className="landing-primary" onClick={onSignUp}><Mail/> Créer mon accès 72 h</button><button className="existing-access" onClick={onOpenApp}>J’ai déjà un compte <ArrowRight/></button><small>Un e-mail de confirmation sécurise l’ouverture de votre espace.</small></motion.div></div>}
  </div>
}
