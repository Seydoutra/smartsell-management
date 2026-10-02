import { ArrowRight, Quote, ShieldCheck, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { publicClientReferences, publicTestimonials } from './lib/socialProof'
import './social-proof.css'

type Props = { language: 'fr' | 'en'; onTrial: () => void }

export default function SocialProof({ language, onTrial }: Props) {
  const en = language === 'en'
  const isDemo = publicClientReferences.every(reference => reference.demo) && publicTestimonials.every(testimonial => testimonial.demo)
  return <section className="social-proof-section" id="references" aria-labelledby="social-proof-title">
    <div className="social-proof-heading">
      <span className="landing-label"><Sparkles/> {en ? 'THE PEOPLE BEHIND THE PROGRESS' : 'DES ÉQUIPES, DES RÉSULTATS'}</span>
      <h2 id="social-proof-title">{en ? 'Built with teams who want to move forward.' : 'Pensé avec les équipes qui veulent avancer.'}</h2>
      <p>{isDemo ? (en ? 'A preview of how client references and stories can appear here. The brands and quotes below are fictional examples.' : 'Aperçu de la présentation des clients et témoignages. Les marques et citations ci-dessous sont des exemples fictifs.') : (en ? 'Discover organizations and real user stories shared with permission.' : 'Découvrez les organisations et les retours d’expérience publiés avec leur accord.')}</p>
      {isDemo && <span className="social-proof-demo-notice">{en ? 'DEMONSTRATION · FICTIONAL REFERENCES' : 'SIMULATION · RÉFÉRENCES FICTIVES'}</span>}
    </div>
    {publicClientReferences.length > 0 ? <div className="social-proof-logos" aria-label={en ? 'Client reference examples' : 'Exemples de références clients'}>{publicClientReferences.map(client => <div className="social-proof-logo" key={client.name}>{client.website ? <a href={client.website} target="_blank" rel="noreferrer"><img src={client.logoUrl} alt={client.name}/></a> : <img src={client.logoUrl} alt={client.name}/>} {client.demo && <small>{en ? 'Sample' : 'Exemple'}</small>}</div>)}</div> : <div className="social-proof-pilot"><ShieldCheck/><span>{en ? 'The first approved client logos will appear here.' : 'Les premiers logos clients seront présentés ici dès validation de leur publication.'}</span></div>}
    {publicTestimonials.length > 0 ? <div className="social-proof-testimonials">{publicTestimonials.map((testimonial, index) => <motion.blockquote key={`${testimonial.name}-${testimonial.company}`} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .08 }}><Quote aria-hidden="true"/><p>« {testimonial.quote} »</p><footer>{testimonial.portraitUrl && <img src={testimonial.portraitUrl} alt=""/>}<span><b>{testimonial.name}</b><small>{testimonial.role} · {testimonial.company}</small></span></footer>{testimonial.demo && <em className="social-proof-sample-label">{en ? 'Fictional testimonial' : 'Témoignage fictif'}</em>}</motion.blockquote>)}</div> : <div className="social-proof-empty"><Quote aria-hidden="true"/><p>{en ? 'Authentic testimonials will appear here once our pilot users approve their publication.' : 'Les témoignages authentiques de nos premiers utilisateurs seront affichés ici après leur accord.'}</p></div>}
    <button className="social-proof-cta" onClick={onTrial}>{en ? 'Be among the first to try it' : 'Faire partie des premiers utilisateurs'} <ArrowRight/></button>
  </section>
}
