export type PublicClientReference = {
  name: string
  logoUrl: string
  website?: string
  demo?: boolean
}

export type PublicTestimonial = {
  quote: string
  name: string
  role: string
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
]
export const publicTestimonials: PublicTestimonial[] = [
  { quote: 'Nous retrouvons nos projets, nos échéances et les décisions importantes dans un seul espace.', name: 'Profil fictif', role: 'Direction', company: 'Aster Studio', demo: true },
  { quote: 'La visibilité sur les tâches et les validations rend la collaboration beaucoup plus simple.', name: 'Profil fictif', role: 'Gestion de projet', company: 'Oryx Digital', demo: true },
]
