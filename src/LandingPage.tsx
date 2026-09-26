import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  Menu,
  MessageSquareText,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { companyProfile } from './lib/companyProfile'
import './landing.css'

const features = [
  {
    icon: BriefcaseBusiness,
    number: '01',
    title: 'Clients & projets',
    copy: 'Centralisez vos prospects, clients, briefs, projets et livrables dans un même espace de travail.',
  },
  {
    icon: Users,
    number: '02',
    title: 'Équipe & opérations',
    copy: 'Assignez les responsabilités, suivez les échéances et donnez à chacun les accès dont il a besoin.',
  },
  {
    icon: CircleDollarSign,
    number: '03',
    title: 'Finance & rentabilité',
    copy: 'Passez du devis au paiement et gardez une vue claire sur les encaissements, dépenses et marges.',
  },
  {
    icon: MessageSquareText,
    number: '04',
    title: 'Communication',
    copy: 'Préparez vos campagnes, relances et validations depuis le contexte complet de chaque client.',
  },
]

const steps = [
  ['01', 'Créez votre espace', 'Configurez votre organisation, votre équipe et vos règles de travail.'],
  ['02', 'Rassemblez votre activité', 'Importez vos clients et pilotez chaque mission depuis une vue unique.'],
  ['03', 'Décidez avec clarté', 'Suivez les priorités, les finances et les prochaines actions en temps réel.'],
]

function ProductPreview() {
  return <motion.div className="landing-product" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .15 }}>
    <div className="landing-product-top">
      <div className="landing-dots"><i/><i/><i/></div>
      <span>Vue d’ensemble</span>
      <div className="landing-live"><i/> Activité synchronisée</div>
    </div>
    <div className="landing-product-shell">
      <aside>
        <img src={companyProfile.logo_light} alt="" />
        <div className="landing-preview-nav">
          <b><BarChart3/> Vue d’ensemble</b>
          <span><BriefcaseBusiness/> Projets</span>
          <span><Users/> Clients</span>
          <span><FileCheck2/> Facturation</span>
        </div>
        <div className="landing-preview-user"><i>AT</i><span><b>Awa Touré</b><small>Administratrice</small></span></div>
      </aside>
      <div className="landing-preview-main">
        <header>
          <div><small>VENDREDI 26 SEPTEMBRE</small><strong>Bonjour, Awa.</strong></div>
          <button aria-label="Nouvel élément">+</button>
        </header>
        <div className="landing-preview-kpis">
          <article className="highlight"><span>Chiffre d’affaires</span><strong>148,6 M</strong><small>GNF · ce mois</small></article>
          <article><span>Projets actifs</span><strong>12</strong><small>4 livraisons proches</small></article>
          <article><span>À encaisser</span><strong>28,4 M</strong><small>7 factures ouvertes</small></article>
        </div>
        <div className="landing-preview-grid">
          <article className="landing-chart">
            <div><b>Performance</b><small>6 derniers mois</small></div>
            <div className="landing-bars">{[38, 52, 44, 68, 61, 86].map((height, index) => <i key={index} style={{ height: `${height}%` }}><span/></i>)}</div>
          </article>
          <article className="landing-tasks">
            <div><b>Priorités</b><small>Voir tout</small></div>
            <p><i className="urgent"/><span><b>Valider la campagne</b><small>Aujourd’hui · 14:30</small></span></p>
            <p><i/><span><b>Envoyer le devis</b><small>Maison Kanu</small></span></p>
            <p><i/><span><b>Préparer le tournage</b><small>Vendredi · 09:00</small></span></p>
          </article>
        </div>
      </div>
    </div>
  </motion.div>
}

export default function LandingPage({ onOpenApp }: { onOpenApp: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const close = () => setMenuOpen(false)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])

  const go = (id: string) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return <div className="landing-page">
    <header className="landing-header">
      <a className="landing-brand" href="#accueil" aria-label="SmartSell, accueil">
        <img src={companyProfile.logo_light} alt="SmartSell" />
        <span>Management</span>
      </a>
      <nav className={menuOpen ? 'open' : ''} aria-label="Navigation principale">
        <button onClick={() => go('solution')}>La solution</button>
        <button onClick={() => go('fonctionnement')}>Fonctionnement</button>
        <button onClick={() => go('securite')}>Sécurité</button>
      </nav>
      <div className="landing-header-actions">
        <button className="landing-login" onClick={onOpenApp}>Se connecter</button>
        <button className="landing-nav-cta" onClick={onOpenApp}>Accéder à mon espace <ArrowRight/></button>
      </div>
      <button className="landing-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}>{menuOpen ? <X/> : <Menu/>}</button>
    </header>

    <main>
      <section className="landing-hero" id="accueil">
        <div className="landing-orb landing-orb-one" aria-hidden="true"/>
        <div className="landing-orb landing-orb-two" aria-hidden="true"/>
        <motion.div className="landing-hero-copy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>
          <div className="landing-kicker"><Sparkles/> La gestion qui fait avancer votre entreprise</div>
          <h1>Un seul espace.<br/><em>Toute votre activité.</em></h1>
          <p>SmartSell réunit vos clients, vos projets, votre équipe et vos finances pour transformer chaque journée de travail en décisions claires.</p>
          <div className="landing-hero-actions">
            <button className="landing-primary" onClick={onOpenApp}>Découvrir mon espace <ArrowRight/></button>
            <button className="landing-secondary" onClick={() => go('solution')}><Play/> Voir comment ça marche</button>
          </div>
          <div className="landing-trust">
            <span><Check/> Données centralisées</span>
            <span><Check/> Accès par rôle</span>
            <span><Check/> Prêt pour vos équipes</span>
          </div>
        </motion.div>
        <ProductPreview/>
        <div className="landing-marquee" aria-label="Fonctions principales">
          <span>CRM</span><i/> <span>PROJETS</span><i/> <span>FACTURATION</span><i/> <span>ÉQUIPE</span><i/> <span>COMMUNICATION</span><i/> <span>REPORTING</span>
        </div>
      </section>

      <section className="landing-features" id="solution">
        <div className="landing-section-head">
          <span>TOUT AU MÊME ENDROIT</span>
          <h2>Moins d’outils.<br/>Plus de maîtrise.</h2>
          <p>Chaque module partage le même contexte. Votre équipe sait quoi faire, pour quel client et avec quel impact.</p>
        </div>
        <div className="landing-feature-grid">
          {features.map((feature, index) => <motion.article key={feature.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ delay: index * .06 }}>
            <div><span>{feature.number}</span><feature.icon/></div>
            <h3>{feature.title}</h3>
            <p>{feature.copy}</p>
            <button onClick={onOpenApp}>Explorer <ChevronRight/></button>
          </motion.article>)}
        </div>
      </section>

      <section className="landing-workflow" id="fonctionnement">
        <div className="landing-workflow-copy">
          <span className="landing-label">SIMPLE À METTRE EN PLACE</span>
          <h2>Votre entreprise organisée en trois mouvements.</h2>
          <p>SmartSell s’adapte à votre fonctionnement sans vous imposer une nouvelle façon de travailler du jour au lendemain.</p>
          <div className="landing-steps">
            {steps.map(([number, title, copy]) => <div key={number}><b>{number}</b><span><strong>{title}</strong><p>{copy}</p></span></div>)}
          </div>
        </div>
        <div className="landing-workflow-visual">
          <div className="landing-pulse"><Zap/><span>Prochaine action</span><strong>Relancer 3 factures arrivées à échéance</strong><button onClick={onOpenApp}>Ouvrir la liste <ArrowRight/></button></div>
          <div className="landing-floating-card one"><span>PROJET</span><strong>Campagne Maison Kanu</strong><small>8 tâches sur 12 terminées</small><i><b/></i></div>
          <div className="landing-floating-card two"><span>ÉQUIPE</span><strong>4 personnes disponibles</strong><div><i>AT</i><i>MD</i><i>FS</i><i>+1</i></div></div>
        </div>
      </section>

      <section className="landing-security" id="securite">
        <div className="landing-security-icon"><ShieldCheck/></div>
        <div>
          <span>SÉCURITÉ PAR CONCEPTION</span>
          <h2>Les bonnes informations, aux bonnes personnes.</h2>
        </div>
        <p>Des rôles précis, un historique des actions et des espaces séparés permettent à votre organisation de grandir sans perdre le contrôle.</p>
        <div className="landing-security-tags"><span>Accès par rôle</span><span>Journal d’activité</span><span>Espaces isolés</span></div>
      </section>

      <section className="landing-final">
        <div className="landing-final-mark">S</div>
        <span>VOTRE ACTIVITÉ MÉRITE MIEUX QUE DES FICHIERS DISPERSÉS</span>
        <h2>Pilotez aujourd’hui.<br/><em>Grandissez demain.</em></h2>
        <p>Retrouvez toute votre entreprise dans un espace pensé pour décider, collaborer et avancer.</p>
        <button className="landing-primary" onClick={onOpenApp}>Accéder à SmartSell <ArrowRight/></button>
      </section>
    </main>

    <footer className="landing-footer">
      <div><img src={companyProfile.logo_light} alt="SmartSell"/><p>La plateforme de gestion pour les équipes qui veulent avancer avec clarté.</p></div>
      <div><strong>Produit</strong><button onClick={() => go('solution')}>Fonctionnalités</button><button onClick={() => go('securite')}>Sécurité</button><button onClick={onOpenApp}>Connexion</button></div>
      <div><strong>Contact</strong><a href={`mailto:${companyProfile.email}`}>{companyProfile.email}</a><a href={`tel:${companyProfile.phone.replaceAll(' ', '')}`}>{companyProfile.phone}</a><span>{companyProfile.address}</span></div>
      <small>© {new Date().getFullYear()} SmartSell. Tous droits réservés.</small>
    </footer>
  </div>
}
