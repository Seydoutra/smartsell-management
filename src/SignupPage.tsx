import { type FormEvent, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { companyProfile } from './lib/companyProfile'
import { isDemoMode } from './services/supabase'
import { resendConfirmationEmail, signInWithGoogle, signUpWithPassword, startSmsSignupOtp, verifySmsSignupOtp } from './services/repository'
import './signup.css'
import BrandCustomizer from './components/BrandCustomizer'
import { persistBrandTheme, readBrandTheme } from './lib/brandTheme'

type Props = { onBack: () => void; onAccess: () => void }

export default function SignupPage({ onBack, onAccess }: Props) {
  const [referralCode] = useState(() => {
    const code = new URLSearchParams(window.location.hash.split('?')[1] || '').get('ref')?.trim().toUpperCase() || ''
    if (/^[A-F0-9]{10}$/.test(code)) localStorage.setItem('smartsell-referral-code', code)
    return /^[A-F0-9]{10}$/.test(code) ? code : localStorage.getItem('smartsell-referral-code') || ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [resendBusy, setResendBusy] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  // SMS verification is the default published signup path so the required
  // phone number is visible immediately instead of being hidden behind a
  // secondary toggle.
  const [smsMode, setSmsMode] = useState(true)
  const [smsChallenge, setSmsChallenge] = useState<{ id: string; email: string; password: string } | null>(null)
  const [smsCode, setSmsCode] = useState('')
  const [verifyingSms, setVerifyingSms] = useState(false)
  const verificationPending = useRef(false)
  const [createdEmail, setCreatedEmail] = useState('')
  const [brandTheme, setBrandTheme] = useState(readBrandTheme)
  const humanizeSignupError = (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : ''
    if (/already been registered|already exists|déjà enregistré|déjà utilisée/i.test(message)) {
      return 'Cette adresse e-mail est déjà utilisée. Connectez-vous avec ce compte ou utilisez « Mot de passe oublié ».'
    }
    return message || 'Inscription impossible pour le moment.'
  }

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
    if (isDemoMode) return setError('L’inscription sécurisée est disponible sur la version publiée de Smartsell Management.')
    setBusy(true)
    try {
      if (smsMode) {
        const phone = String(form.get('phone') || '').trim()
        const result = await startSmsSignupOtp({ phone, email, fullName, companyName })
        if (!result?.challenge_id) throw new Error('La confirmation SMS n’a pas pu démarrer. Réessayez dans quelques instants.')
        setSmsCode('')
        setSmsChallenge({ id: result.challenge_id, email, password })
        setError('')
      } else {
        const result = await signUpWithPassword({ email, password, fullName, companyName, referralCode })
        if (result.session) {
          persistBrandTheme(brandTheme)
          sessionStorage.setItem('smartsell-show-welcome', '1')
          onAccess()
        } else setConfirmationEmail(email)
      }
    } catch (reason) {
      setError(humanizeSignupError(reason))
    } finally { setBusy(false) }
  }

  const confirmSms = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!smsChallenge || verificationPending.current) return
    if (!/^\d{6}$/.test(smsCode)) return setError('Saisissez les 6 chiffres du code reçu par SMS.')
    verificationPending.current = true
    setVerifyingSms(true)
    setError('')
    try {
      const result = await verifySmsSignupOtp({ challengeId: smsChallenge.id, code: smsCode, password: smsChallenge.password, referralCode })
      if (!result?.success) throw new Error('Le compte n’a pas pu être créé. Réessayez la validation du code.')
      persistBrandTheme(brandTheme)
      sessionStorage.setItem('smartsell-show-welcome', '1')
      setCreatedEmail(result.email || smsChallenge.email)
      setSmsChallenge(null)
      setSmsCode('')
    } catch (reason) {
      setError(humanizeSignupError(reason))
    } finally {
      verificationPending.current = false
      setVerifyingSms(false)
    }
  }

  if (createdEmail) return <main className="signup-page confirmation-state">
    <section className="signup-confirmation">
      <div className="confirmation-icon"><Check/></div>
      <span>COMPTE CONFIRMÉ</span>
      <h1>Votre compte est créé.</h1>
      <p>Connectez-vous avec <strong>{createdEmail}</strong> et le mot de passe que vous venez de choisir.</p>
      <button type="button" onClick={onAccess}>Se connecter <ArrowRight/></button>
    </section>
  </main>

  if (confirmationEmail) return <main className="signup-page confirmation-state">
    <section className="signup-confirmation">
      <div className="confirmation-icon"><Mail/></div>
      <span>DERNIÈRE ÉTAPE</span>
      <h1>Vérifiez votre boîte mail.</h1>
      <p>Nous avons envoyé un lien de confirmation à <strong>{confirmationEmail}</strong>. Cliquez dessus pour activer votre démo de 72 heures.</p>
      <div><Check/> L’accès démarre après validation de votre adresse</div>
      <div><Check/> Votre espace sera protégé et personnel</div>
      {resendMessage && <p className="confirmation-note">{resendMessage}</p>}
      <button onClick={async () => { setResendBusy(true); setResendMessage(''); try { await resendConfirmationEmail(confirmationEmail); setResendMessage('Nouveau lien envoyé. Vérifiez aussi vos courriers indésirables.'); } catch (reason) { setResendMessage(reason instanceof Error ? reason.message : 'Impossible de renvoyer le lien.'); } finally { setResendBusy(false); } }} disabled={resendBusy}>{resendBusy ? 'Envoi…' : 'Renvoyer le lien de confirmation'}</button>
      <button onClick={onAccess}>J’ai confirmé mon adresse <ArrowRight/></button>
      <button className="text-button" onClick={() => setConfirmationEmail('')}>Modifier mon adresse</button>
    </section>
  </main>

  if (smsChallenge) return <main className="signup-page confirmation-state">
    <section className="signup-confirmation">
      <div className="confirmation-icon"><Mail/></div>
      <span>CONFIRMATION PAR SMS</span>
      <h1>Entrez le code reçu.</h1>
      <p>Un code à 6 chiffres a été envoyé par Nimba au numéro indiqué. Il est valable 10 minutes.</p>
      <form className="signup-otp-form" onSubmit={confirmSms} aria-busy={verifyingSms}>
        <label htmlFor="signup-sms-code">Code reçu par SMS</label>
        <input id="signup-sms-code" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required autoFocus placeholder="000000" value={smsCode} onChange={event => { setSmsCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} aria-describedby="signup-sms-help" aria-invalid={Boolean(error)}/>
        <p id="signup-sms-help">Saisissez ou collez les 6 chiffres reçus, puis validez votre compte.</p>
        {error && <div className="signup-error" role="alert"><LockKeyhole/>{error}</div>}
        <button type="submit" className="signup-submit" disabled={verifyingSms}>{verifyingSms ? 'Vérification…' : 'Valider et créer mon espace'} <ArrowRight/></button>
      </form>
      <button type="button" className="text-button" disabled={verifyingSms} onClick={() => { setSmsChallenge(null); setSmsCode(''); setError('') }}>Revenir au formulaire</button>
    </section>
  </main>

  return <main className="signup-page">
    <section className="signup-story">
      <button className="signup-back" onClick={onBack}><ArrowLeft/> Retour au site</button>
      <img src={companyProfile.logo_light} alt="Smartsell Management"/>
      <div className="signup-story-copy"><span><Sparkles/> DÉMO PERSONNALISÉE</span><h1>72 heures pour reprendre le contrôle.</h1><p>Créez votre accès, explorez la plateforme et découvrez comment chaque métier avance dans le même espace.</p><div className="signup-benefits"><span><Check/> Les modules essentiels disponibles</span><span><Check/> Un espace sécurisé à votre nom</span><span><Check/> Aucun paiement avant votre décision</span></div></div>
      <small><ShieldCheck/> L’accès est suspendu automatiquement après 72 heures sans activation d’une offre.</small>
    </section>
    <section className="signup-panel">
      <form className="signup-card" onSubmit={submit}>
        <span className="signup-eyebrow"><i/> CRÉER MON ESPACE</span>
        <h2>Bienvenue chez Smartsell Management.</h2>
        <p>Quelques informations suffisent pour commencer.</p>
        {referralCode&&<p className="signup-referral-note">Votre parrainage est associé à ce compte. La réduction sera appliquée sur votre premier paiement mensuel confirmé.</p>}
        <button type="button" className="google-button" onClick={async () => { setError(''); if (isDemoMode) return setError('La connexion Google sera disponible sur la version publiée.'); setBusy(true); try { await signInWithGoogle() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Connexion Google impossible.') } finally { setBusy(false) } }}><b>G</b> Continuer avec Google</button>
        <div className="signup-divider"><span/>inscription sécurisée par SMS<span/></div>
        <div className="signup-fields"><label>Nom complet<input name="fullName" autoComplete="name" required placeholder="Awa Touré"/></label><label>Entreprise<input name="companyName" autoComplete="organization" required placeholder="Votre entreprise"/></label></div>
        <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required placeholder="vous@entreprise.com"/></label>
        {smsMode && <label>Téléphone guinéen<input name="phone" type="tel" autoComplete="tel" required placeholder="+224 620 00 00 00"/></label>}
        <BrandCustomizer value={brandTheme} onChange={setBrandTheme}/>
        <label>Mot de passe<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} minLength={10} autoComplete="new-password" required placeholder="10 caractères minimum"/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? <EyeOff/> : <Eye/>}</button></div><small>Majuscule, minuscule et chiffre requis.</small></label>
        <label>Confirmer le mot de passe<input name="confirmation" type={showPassword ? 'text' : 'password'} minLength={10} autoComplete="new-password" required/></label>
        {error && <div className="signup-error"><LockKeyhole/>{error}</div>}
        <label className="signup-consent"><input type="checkbox" required/><span>J’accepte que Smartsell Management crée mon espace d’essai et me contacte au sujet de cette demande.</span></label>
        <button className="signup-submit" disabled={busy}>{busy ? (smsMode ? 'Envoi du code…' : 'Création en cours…') : (smsMode ? 'Recevoir mon code SMS' : 'Créer ma démo de 72 h')} <ArrowRight/></button>
        {smsMode ? <p className="signup-sms-note">Un code de confirmation sera envoyé par SMS. Votre e-mail servira ensuite d’identifiant de connexion.</p> : <button type="button" className="text-button" onClick={() => { setSmsMode(true); setError('') }}>Utiliser la confirmation par SMS</button>}
        <p className="signup-login">Vous avez déjà un compte ? <button type="button" onClick={onAccess}>Se connecter</button></p>
      </form>
    </section>
  </main>
}
