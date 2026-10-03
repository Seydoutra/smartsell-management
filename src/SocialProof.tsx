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
  const isDemo = publicClientReferences.every(reference => reference.demo) && publicTestimonials.every(testimonial => testimonial.demo)
  const logos = useCarousel(245)
  const testimonials = useCarousel(370)
  return <section className="social-proof-section" id="references" aria-labelledby="social-proof-title">
    <div className="social-proof-heading">
      <span className="landing-label"><Sparkles/> {en ? 'ILLUSTRATED STORIES' : 'EXEMPLES D’UTILISATION'}</span>
      <h2 id="social-proof-title">{en ? 'Imagine your team’s success here.' : 'Imaginez votre équipe ici.'}</h2>
      <p>{isDemo ? (en ? 'These 13 brands and 12 testimonials are fictional illustrations, not real clients or endorsements.' : 'Ces 13 marques et 12 témoignages sont des illustrations fictives, pas de vrais clients ni des avis reçus.') : (en ? 'Discover organizations and real user stories shared with permission.' : 'Découvrez les organisations et les retours d’expérience publiés avec leur accord.')}</p>
      {isDemo && <span className="social-proof-demo-notice">{en ? 'DEMONSTRATION · FICTIONAL REFERENCES' : 'SIMULATION · RÉFÉRENCES FICTIVES'}</span>}
    </div>
    {publicClientReferences.length > 0 ? <>
      <div className="social-proof-row-title"><h3>{en ? 'Illustrative brands' : 'Marques illustratives'}</h3><div><button type="button" onClick={() => logos.move(-1)} aria-label={en ? 'Previous brands' : 'Marques précédentes'}><ArrowLeft/></button><button type="button" onClick={() => logos.move(1)} aria-label={en ? 'Next brands' : 'Marques suivantes'}><ArrowRight/></button></div></div>
      <div className="social-proof-logos" ref={logos.ref} onMouseEnter={() => logos.setPaused(true)} onMouseLeave={() => logos.setPaused(false)} onFocusCapture={() => logos.setPaused(true)} onBlurCapture={() => logos.setPaused(false)} aria-label={en ? 'Fictional brand examples' : 'Exemples de marques fictives'}>{publicClientReferences.map(client => <div className="social-proof-logo" key={client.name}>{client.logoUrl ? <img src={client.logoUrl} alt={client.name}/> : <div className="social-proof-lettermark" style={{ '--mark-color': client.color } as CSSProperties}><b>{client.mark}</b><span>{client.name}</span></div>}{client.demo && <small>{en ? 'Fictional example' : 'Exemple fictif'}</small>}</div>)}</div>
    </> : <div className="social-proof-pilot"><ShieldCheck/><span>{en ? 'The first approved client logos will appear here.' : 'Les premiers logos clients seront présentés ici dès validation de leur publication.'}</span></div>}
    {publicTestimonials.length > 0 ? <>
      <div className="social-proof-row-title"><h3>{en ? 'Illustrative testimonials' : 'Témoignages illustratifs'}</h3><div><button type="button" onClick={() => testimonials.move(-1)} aria-label={en ? 'Previous testimonials' : 'Témoignages précédents'}><ArrowLeft/></button><button type="button" onClick={() => testimonials.move(1)} aria-label={en ? 'Next testimonials' : 'Témoignages suivants'}><ArrowRight/></button></div></div>
      <div className="social-proof-testimonials" ref={testimonials.ref} onMouseEnter={() => testimonials.setPaused(true)} onMouseLeave={() => testimonials.setPaused(false)} onFocusCapture={() => testimonials.setPaused(true)} onBlurCapture={() => testimonials.setPaused(false)}>{publicTestimonials.map(testimonial => <blockquote key={`${testimonial.name}-${testimonial.company}`}><Quote aria-hidden="true"/><p>« {en ? testimonial.quoteEn : testimonial.quote} »</p><footer><span><b>{en ? 'Fictional profile' : testimonial.name}</b><small>{en ? testimonial.roleEn : testimonial.role} · {testimonial.company}</small></span></footer>{testimonial.demo && <em className="social-proof-sample-label">{en ? 'Fictional testimonial' : 'Témoignage fictif'}</em>}</blockquote>)}</div>
    </> : <div className="social-proof-empty"><Quote aria-hidden="true"/><p>{en ? 'Authentic testimonials will appear here once our pilot users approve their publication.' : 'Les témoignages authentiques de nos premiers utilisateurs seront affichés ici après leur accord.'}</p></div>}
    <button className="social-proof-cta" onClick={onTrial}>{en ? 'Be among the first to try it' : 'Faire partie des premiers utilisateurs'} <ArrowRight/></button>
  </section>
}
