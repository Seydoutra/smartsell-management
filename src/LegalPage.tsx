import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
import { companyProfile } from './lib/companyProfile'
import './legal.css'

type LegalKind = 'privacy' | 'terms'

const privacy = [
  ['Données traitées', 'Nous traitons les informations nécessaires à la création et à la sécurisation de votre compte, ainsi que les données métier que vous choisissez d’enregistrer dans SmartSell.'],
  ['Finalités', 'Ces données servent à fournir la plateforme, personnaliser votre espace, gérer la période d’essai, envoyer les messages de service et protéger les accès.'],
  ['Connexion Google', 'Si vous utilisez Google, SmartSell reçoit uniquement les informations de profil nécessaires à l’authentification. Votre mot de passe Google ne nous est jamais communiqué.'],
  ['Hébergement et prestataires', 'Les services techniques indispensables, notamment l’authentification et l’hébergement de données, peuvent être fournis par des prestataires spécialisés soumis à des obligations de sécurité.'],
  ['Conservation et sécurité', 'Les données sont conservées pendant la relation contractuelle et la durée nécessaire au respect de nos obligations. Des contrôles d’accès, journaux et mesures de sécurité protègent les espaces.'],
  ['Vos droits', 'Vous pouvez demander l’accès, la correction ou la suppression de vos données en écrivant à notre adresse de contact.'],
]

const terms = [
  ['Objet', 'SmartSell est une plateforme de gestion d’entreprise réunissant notamment CRM, projets, planning, production, éditorial, finance, équipe, documents et automatisations.'],
  ['Essai de 72 heures', 'L’accès d’essai est disponible pendant 72 heures à compter de l’activation du compte. À son terme, l’accès peut être suspendu jusqu’à l’achat ou l’activation d’un abonnement.'],
  ['Abonnement ou licence', 'L’utilisation au-delà de l’essai dépend de l’offre souscrite. Les fonctions, quotas, utilisateurs inclus, services d’intégration et conditions de maintenance sont précisés dans la proposition commerciale.'],
  ['Utilisation acceptable', 'L’utilisateur s’engage à protéger ses accès, à respecter les droits des tiers et à ne pas utiliser le service à des fins illicites, frauduleuses ou susceptibles de compromettre sa sécurité.'],
  ['Données et propriété', 'Le client reste propriétaire de ses données. SmartSell conserve les droits relatifs au logiciel, à son architecture et à ses composants, sauf disposition différente convenue par écrit.'],
  ['Disponibilité et responsabilité', 'Nous mettons en œuvre des moyens raisonnables pour assurer la continuité et la sécurité du service. Les engagements spécifiques de disponibilité ou d’assistance sont définis par l’offre choisie.'],
]

export default function LegalPage({ kind, onBack }: { kind: LegalKind; onBack: () => void }) {
  const isPrivacy = kind === 'privacy'
  const sections = isPrivacy ? privacy : terms
  return <main className="legal-page">
    <div className="legal-glow"/>
    <header><button onClick={onBack}><ArrowLeft/> Retour au site</button><img src={companyProfile.logo_light} alt="SmartSell"/></header>
    <section className="legal-hero"><span><ShieldCheck/> DOCUMENT LÉGAL</span><h1>{isPrivacy ? 'Politique de confidentialité' : 'Conditions d’utilisation'}</h1><p>{isPrivacy ? 'Comment SmartSell protège et utilise les informations confiées à la plateforme.' : 'Les règles essentielles pour utiliser SmartSell avec clarté et confiance.'}</p><small>Dernière mise à jour : 26 septembre 2026</small></section>
    <section className="legal-content">{sections.map(([title, copy], index) => <article key={title}><b>{String(index + 1).padStart(2, '0')}</b><div><h2>{title}</h2><p>{copy}</p></div></article>)}</section>
    <footer><Mail/><p>Une question ? Écrivez-nous à <a href={`mailto:${companyProfile.email}`}>{companyProfile.email}</a></p></footer>
  </main>
}
