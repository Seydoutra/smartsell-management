import { type FormEvent, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { companyProfile } from './lib/companyProfile'
import { isDemoMode } from './services/supabase'
import { signInWithGoogle, signUpWithPassword } from './services/repository'
import './signup.css'

type Props = { onBack: () => void; onAccess: () => void }

export default function SignupPage({ onBack, onAccess }: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmationEmail, setConfirmationEmail] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const fullName = String(form.get('fullName') || '').trim()
    const companyName = String(form.get('companyName') || '').trim()
    const email = String(form.get('email') || '').trim().toLowerCase()
    const password = String(form.get('password') || '')
    const confirmation = String(form.get('confirmation') || '')
    if (password !== confirmation) return setError('Les deux mots de passe ne correspondent pas.')
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return setError('Choisissez au moins 10 caractères avec une majuscule, une minuscule et un chiffre.')
    if (isDemoMode) return setError('L’inscription sécurisée est disponible sur la version publiée de SmartSell.')
    setBusy(true)
    try {
      const result = await signUpWithPassword({ email, password, fullName, companyName })
      if (result.session) {
        sessionStorage.setItem('smartsell-show-welcome', '1')
        onAccess()
      } else setConfirmationEmail(email)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Inscription impossible pour le moment.')
    } finally { setBusy(false) }
  }

  if (confirmationEmail) return <main className="signup-page confirmation-state">
    <section className="signup-confirmation">
      <div className="confirmation-icon"><Mail/></div>
      <span>DERNIÈRE ÉTAPE</span>
      <h1>Vérifiez votre boîte mail.</h1>
      <p>Nous avons envoyé un lien de confirmation à <strong>{confirmationEmail}</strong>. Cliquez dessus pour activer votre démo de 72 heures.</p>
      <div><Check/> L’accès démarre après validation de votre adresse</div>
      <div><Check/> Votre espace sera protégé et personnel</div>
      <button onClick={onAccess}>J’ai confirmé mon adresse <ArrowRight/></button>
      <button className="text-button" onClick={() => setConfirmationEmail('')}>Modifier mon adresse</button>
    </section>
  </main>

  return <main className="signup-page">
    <section className="signup-story">
      <button className="signup-back" onClick={onBack}><ArrowLeft/> Retour au site</button>
      <img src={companyProfile.logo_light} alt="SmartSell"/>
      <div className="signup-story-copy"><span><Sparkles/> DÉMO PERSONNALISÉE</span><h1>72 heures pour reprendre le contrôle.</h1><p>Créez votre accès, explorez la plateforme et découvrez comment chaque métier avance dans le même espace.</p><div className="signup-benefits"><span><Check/> Les modules essentiels disponibles</span><span><Check/> Un espace sécurisé à votre nom</span><span><Check/> Aucun paiement avant votre décision</span></div></div>
      <small><ShieldCheck/> L’accès est suspendu automatiquement après 72 heures sans activation d’une offre.</small>
    </section>
    <section className="signup-panel">
      <form className="signup-card" onSubmit={submit}>
        <span className="signup-eyebrow"><i/> CRÉER MON ESPACE</span>
        <h2>Bienvenue chez SmartSell.</h2>
        <p>Quelques informations suffisent pour commencer.</p>
        <button type="button" className="google-button" onClick={async () => { setError(''); if (isDemoMode) return setError('La connexion Google sera disponible sur la version publiée.'); setBusy(true); try { await signInWithGoogle() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Connexion Google impossible.') } finally { setBusy(false) } }}><b>G</b> Continuer avec Google</button>
        <div className="signup-divider"><span/>ou avec votre e-mail<span/></div>
        <div className="signup-fields"><label>Nom complet<input name="fullName" autoComplete="name" required placeholder="Awa Touré"/></label><label>Entreprise<input name="companyName" autoComplete="organization" required placeholder="Votre entreprise"/></label></div>
        <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required placeholder="vous@entreprise.com"/></label>
        <label>Mot de passe<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} minLength={10} autoComplete="new-password" required placeholder="10 caractères minimum"/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? <EyeOff/> : <Eye/>}</button></div><small>Majuscule, minuscule et chiffre requis.</small></label>
        <label>Confirmer le mot de passe<input name="confirmation" type={showPassword ? 'text' : 'password'} minLength={10} autoComplete="new-password" required/></label>
        {error && <div className="signup-error"><LockKeyhole/>{error}</div>}
        <label className="signup-consent"><input type="checkbox" required/><span>J’accepte que SmartSell crée mon espace d’essai et me contacte au sujet de cette demande.</span></label>
        <button className="signup-submit" disabled={busy}>{busy ? 'Création en cours…' : 'Créer ma démo de 72 h'} <ArrowRight/></button>
        <p className="signup-login">Vous avez déjà un compte ? <button type="button" onClick={onAccess}>Se connecter</button></p>
      </form>
    </section>
  </main>
}
