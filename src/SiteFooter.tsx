import { ArrowRight, ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { companyProfile } from './lib/companyProfile'
import { marketingPath } from './lib/marketingRoutes'
import './site-footer.css'

export default function SiteFooter({language='fr',onHome,onSignUp,onLogin}:{language?:'fr'|'en';onHome:()=>void;onSignUp:()=>void;onLogin:()=>void}){
  const en=language==='en'
  return <footer className="site-footer">
    <div className="site-footer-inner">
      <div className="site-footer-lead"><div><span>{en?'READY FOR A CLEARER WAY TO WORK?':'PRÊT À TRAVAILLER PLUS CLAIREMENT ?'}</span><h2>{en?'Your next chapter starts here.':'La suite commence ici.'}</h2><p>{en?'Try your own Smartsell Management workspace for 72 hours.':'Essayez votre propre espace Smartsell Management pendant 72 heures.'}</p></div><button onClick={onSignUp}>{en?'Start my free trial':'Créer mon compte d’essai'} <ArrowRight/></button></div>
      <div className="site-footer-grid">
        <div className="site-footer-brand"><button onClick={onHome} aria-label={en?'Smartsell Management home':'Accueil Smartsell Management'}><img src={companyProfile.logo_light} alt="Smartsell Management"/></button><p>{en?'A connected workspace for your clients, projects, team, communication and finance.':'Un espace connecté pour vos clients, projets, équipes, communications et finances.'}</p><span>{en?'Made for teams in motion.':'Pensé pour les équipes en mouvement.'}</span></div>
        <nav aria-label={en?'Discover Smartsell Management':'Découvrir Smartsell Management'}><strong>{en?'Explore':'Explorer'}</strong><button onClick={onHome}>{en?'Home':'Accueil'}</button><a href={marketingPath('solutions')}>{en?'Features':'Fonctionnalités'}</a><a href={marketingPath('fonctionnement')}>{en?'How it works':'Fonctionnement'}</a><a href={marketingPath('personnalisation')}>{en?'Customization':'Personnalisation'}</a><a href={marketingPath('tarifs')}>{en?'Pricing':'Tarifs'}</a></nav>
        <nav aria-label={en?'Resources':'Ressources'}><strong>{en?'Your journey':'Votre parcours'}</strong><button onClick={onSignUp}>{en?'Free 72-hour trial':'Essai gratuit 72 h'}</button><button onClick={onLogin}>{en?'Log in':'Connexion'}</button><a href={marketingPath('parrainage')}>{en?'Referral program':'Parrainage'}</a><a href={`${import.meta.env.BASE_URL}#privacy`}>{en?'Privacy':'Confidentialité'}</a><a href={`${import.meta.env.BASE_URL}#terms`}>{en?'Terms':'Conditions'}</a></nav>
        <div className="site-footer-contact"><strong>Contact</strong><a href={`mailto:${companyProfile.email}`}><Mail/>{companyProfile.email}</a><a href="tel:+224620619064"><Phone/>+224 620 61 90 64</a><a href="https://wa.me/224620619064" target="_blank" rel="noreferrer"><MessageCircle/>WhatsApp <ArrowUpRight/></a><span><MapPin/>{companyProfile.address}</span><a className="site-footer-contact-page" href={marketingPath('contact')}>{en?'All contact options':'Toutes les coordonnées'} <ArrowRight/></a></div>
      </div>
      <div className="site-footer-bottom"><span>© {new Date().getFullYear()} Smartsell Management. {en?'All rights reserved.':'Tous droits réservés.'}</span><button onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>{en?'Back to top':'Retour en haut'} ↑</button></div>
    </div>
  </footer>
}
