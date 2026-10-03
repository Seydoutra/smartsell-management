import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Quote, ShieldCheck, Sparkles } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { publicClientReferences, publicTestimonials } from './lib/socialProof'
import './social-proof.css'

type Props = { language: 'fr' | 'en'; onTrial: () => void }

function useCarousel(step: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const reduced = Boolean(useReducedMotion())
  const move = (direction: number) => ref.current?.scrollBy({ left: direction * step, behavior: reduced ? 'instant' : 'smooth' })
  useEffect(() => {
    if (paused || reduced) return
    const timer = window.setInterval(() => {
      const element = ref.current
      if (!element) return
      const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 8
      element.scrollTo({ left: atEnd ? 0 : element.scrollLeft + step, behavior: 'smooth' })
    }, 4800)
    return () => window.clearInterval(timer)
  }, [paused, reduced, step])
  return { ref, setPaused, move }
}

export default function SocialProof({ language, onTrial }: Props) {
  const en = language === 'en'
  const approvedClients = publicClientReferences.filter(reference => !reference.demo)
  const approvedTestimonials = publicTestimonials.filter(testimonial => !testimonial.demo)
  const logos = useCarousel(245)
  const testimonials = useCarousel(370)
  return <section className="social-proof-section" id="references" aria-labelledby="social-proof-title">
    <div className="social-proof-heading">
      <span className="landing-label"><Sparkles/> {en ? 'BUILT FOR TEAMS IN MOTION' : 'PENSÉ POUR LES ÉQUIPES EN MOUVEMENT'}</span>
      <h2 id="social-proof-title">{approvedClients.length ? (en ? 'They put their trust in us.' : 'Ils nous font confiance.') : (en ? 'Your team’s next chapter starts here.' : 'Votre équipe passe à la vitesse supérieure.')}</h2>
      <p>{approvedClients.length ? (en ? 'Discover organizations that approved the public use of their identity.' : 'Découvrez les organisations qui ont autorisé la publication de leur identité.') : (en ? 'Sales, creation, projects and finance finally move forward in one shared workspace.' : 'Commercial, création, projets et finance avancent enfin dans un même espace de travail.')}</p>
    </div>
    {approvedClients.length > 0 && <>
      <div className="social-proof-row-title"><h3>{en ? 'Our clients' : 'Nos clients'}</h3><div><button type="button" onClick={() => logos.move(-1)} aria-label={en ? 'Previous brands' : 'Marques précédentes'}><ArrowLeft/></button><button type="button" onClick={() => logos.move(1)} aria-label={en ? 'Next brands' : 'Marques suivantes'}><ArrowRight/></button></div></div>
      <div className="social-proof-logos" ref={logos.ref} onMouseEnter={() => logos.setPaused(true)} onMouseLeave={() => logos.setPaused(false)} onFocusCapture={() => logos.setPaused(true)} onBlurCapture={() => logos.setPaused(false)}>{approvedClients.map(client => <div className="social-proof-logo" key={client.name}>{client.logoUrl ? <img src={client.logoUrl} alt={client.name}/> : <div className="social-proof-lettermark" style={{ '--mark-color': client.color } as CSSProperties}><b>{client.mark}</b><span>{client.name}</span></div>}</div>)}</div>
    </>}
    {approvedTestimonials.length > 0 ? <>
      <div className="social-proof-row-title"><h3>{en ? 'What our clients say' : 'Ce que disent nos clients'}</h3><div><button type="button" onClick={() => testimonials.move(-1)} aria-label={en ? 'Previous testimonials' : 'Témoignages précédents'}><ArrowLeft/></button><button type="button" onClick={() => testimonials.move(1)} aria-label={en ? 'Next testimonials' : 'Témoignages suivants'}><ArrowRight/></button></div></div>
      <div className="social-proof-testimonials" ref={testimonials.ref} onMouseEnter={() => testimonials.setPaused(true)} onMouseLeave={() => testimonials.setPaused(false)} onFocusCapture={() => testimonials.setPaused(true)} onBlurCapture={() => testimonials.setPaused(false)}>{approvedTestimonials.map(testimonial => <blockquote key={`${testimonial.name}-${testimonial.company}`}><Quote aria-hidden="true"/><p>« {en ? testimonial.quoteEn : testimonial.quote} »</p><footer><span><b>{testimonial.name}</b><small>{en ? testimonial.roleEn : testimonial.role} · {testimonial.company}</small></span></footer></blockquote>)}</div>
    </> : <div className="social-proof-benefits" aria-label={en ? 'What Smartsell Management helps you achieve' : 'Ce que Smartsell Management vous aide à accomplir'}>{(en ? [['01','See the whole picture','Projects, deadlines and priorities in one place.'],['02','Work together','Each teammate finds their tasks and conversations.'],['03','Move faster','Content, campaigns and decisions stay connected.']] : [['01','Voir l’essentiel','Projets, échéances et priorités dans un seul espace.'],['02','Avancer ensemble','Chacun retrouve ses tâches et ses échanges.'],['03','Gagner du temps','Contenus, campagnes et décisions restent liés.']]).map(([number,title,copy])=><article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p><ShieldCheck/></article>)}</div>}
    <button className="social-proof-cta" onClick={onTrial}>{en ? 'Adopt Smartsell Management' : 'Adoptez Smartsell Management'} <ArrowRight/></button>
  </section>
}
