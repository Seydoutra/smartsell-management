export type PublicClientReference = {
  name: string
  logoUrl?: string
  mark?: string
  color?: string
  website?: string
  demo?: boolean
}

export type PublicTestimonial = {
  quote: string
  quoteEn: string
  name: string
  role: string
  roleEn: string
  company: string
  portraitUrl?: string
  demo?: boolean
}

// Add only references whose owners have explicitly approved public display.
// These sample identities are explicitly marked as simulations on the public page.
export const publicClientReferences: PublicClientReference[] = [
  { name: 'Aster Studio', logoUrl: `${import.meta.env.BASE_URL}demo-brands/aster.svg`, demo: true },
  { name: 'Oryx Digital', logoUrl: `${import.meta.env.BASE_URL}demo-brands/oryx.svg`, demo: true },
  { name: 'Linea Conseil', logoUrl: `${import.meta.env.BASE_URL}demo-brands/linea.svg`, demo: true },
  { name: 'Kora Creative', mark: 'KC', color: '#f1b451', demo: true },
  { name: 'Fouta Lab', mark: 'FL', color: '#82d9c3', demo: true },
  { name: 'Nimba Atelier', mark: 'NA', color: '#a78be8', demo: true },
  { name: 'Kaloum Conseil', mark: 'KC', color: '#f18b9a', demo: true },
  { name: 'Baobab Media', mark: 'BM', color: '#c4dc7a', demo: true },
  { name: 'Sira Studio', mark: 'SS', color: '#8bc7f1', demo: true },
  { name: 'Nova Guinée', mark: 'NG', color: '#efb37d', demo: true },
  { name: 'Teriya Digital', mark: 'TD', color: '#c99ad7', demo: true },
  { name: 'Mansa Partners', mark: 'MP', color: '#92ddab', demo: true },
  { name: 'Djeli Production', mark: 'DP', color: '#e7d879', demo: true },
]
export const publicTestimonials: PublicTestimonial[] = [
  { quote: 'Nous retrouvons nos projets, nos échéances et les décisions importantes dans un seul espace.', quoteEn: 'Projects, deadlines and key decisions are finally in one place.', name: 'Profil fictif', role: 'Direction', roleEn: 'Management', company: 'Aster Studio', demo: true },
  { quote: 'La visibilité sur les tâches et les validations rend la collaboration beaucoup plus simple.', quoteEn: 'Clear tasks and approvals make collaboration much easier.', name: 'Profil fictif', role: 'Gestion de projet', roleEn: 'Project management', company: 'Oryx Digital', demo: true },
  { quote: 'Notre équipe sait exactement quoi livrer et à quel moment.', quoteEn: 'Our team knows exactly what to deliver and when.', name: 'Profil fictif', role: 'Production', roleEn: 'Production', company: 'Kora Creative', demo: true },
  { quote: 'La vue du calendrier éditorial nous aide à préparer chaque publication.', quoteEn: 'The editorial calendar helps us prepare every post.', name: 'Profil fictif', role: 'Communication', roleEn: 'Communications', company: 'Baobab Media', demo: true },
  { quote: 'Un espace client clair change la qualité de nos échanges.', quoteEn: 'A clear client portal changes the quality of our conversations.', name: 'Profil fictif', role: 'Relation client', roleEn: 'Client relations', company: 'Sira Studio', demo: true },
  { quote: 'Les devis et les factures sont reliés au travail qui les a produits.', quoteEn: 'Quotes and invoices connect to the work behind them.', name: 'Profil fictif', role: 'Finance', roleEn: 'Finance', company: 'Mansa Partners', demo: true },
  { quote: 'Nous voyons les priorités de la semaine sans chercher dans plusieurs outils.', quoteEn: 'We see weekly priorities without searching several tools.', name: 'Profil fictif', role: 'Direction', roleEn: 'Management', company: 'Fouta Lab', demo: true },
  { quote: 'Chaque projet a un responsable et des étapes compréhensibles.', quoteEn: 'Each project has a clear owner and understandable milestones.', name: 'Profil fictif', role: 'Coordination', roleEn: 'Coordination', company: 'Nimba Atelier', demo: true },
  { quote: 'Les validations créatives deviennent plus simples pour nos clients.', quoteEn: 'Creative approvals become easier for our clients.', name: 'Profil fictif', role: 'Design', roleEn: 'Design', company: 'Djeli Production', demo: true },
  { quote: 'Les informations commerciales et opérationnelles avancent ensemble.', quoteEn: 'Sales and operations move forward with the same information.', name: 'Profil fictif', role: 'Commercial', roleEn: 'Sales', company: 'Nova Guinée', demo: true },
  { quote: 'Nos collaborateurs voient leurs tâches sans perdre le contexte client.', quoteEn: 'Our teammates see their tasks without losing client context.', name: 'Profil fictif', role: 'Équipe', roleEn: 'Team', company: 'Teriya Digital', demo: true },
  { quote: 'Le suivi des objectifs nous aide à décider où concentrer nos efforts.', quoteEn: 'Goal tracking helps us decide where to focus.', name: 'Profil fictif', role: 'Stratégie', roleEn: 'Strategy', company: 'Kaloum Conseil', demo: true },
]
