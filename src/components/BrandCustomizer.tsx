import { useState } from 'react'
import { Check, ImagePlus, RotateCcw, Sparkles } from 'lucide-react'
import { BrandTheme, contrastRatio, defaultBrandTheme, extractPalette } from '../lib/brandTheme'

type Props = { value: BrandTheme; onChange: (theme: BrandTheme) => void }

export default function BrandCustomizer({ value, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const ratio = contrastRatio(value.primary, value.surface)
  const update = (key: keyof BrandTheme, next: string) => onChange({ ...value, [key]: next })
  const chooseLogo = async (file?: File) => { if (!file) return; setBusy(true); try { onChange(await extractPalette(file)) } finally { setBusy(false) } }
  return <section className="brand-customizer">
    <div className="brand-customizer-head"><div><span className="signup-eyebrow"><i/><Sparkles size={13}/> IDENTITÉ DE MARQUE</span><h3>Personnalisez votre espace <small>facultatif</small></h3><p>Importez votre logo : SmartSell propose automatiquement une palette adaptée à votre marque.</p></div>{value.logoDataUrl && <img src={value.logoDataUrl} alt="Logo importé"/>}</div>
    <label className="brand-upload"><ImagePlus size={17}/>{busy ? 'Analyse du logo…' : 'Importer mon logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => chooseLogo(e.target.files?.[0])}/></label>
    <div className="brand-swatches">{(['primary','secondary','accent'] as const).map((key, index) => <label key={key}><span>{['Principale','Secondaire','Accent'][index]}</span><input type="color" value={value[key]} onChange={e => update(key, e.target.value)}/><code>{value[key].toUpperCase()}</code></label>)}</div>
    <div className="brand-preview" style={{ '--preview-primary': value.primary, '--preview-secondary': value.secondary, '--preview-accent': value.accent, '--preview-surface': value.surface } as React.CSSProperties}><div><b>Aperçu de votre espace</b><small>Votre identité, partout dans l’application.</small></div><button type="button"><Check size={15}/> Continuer</button></div>
    <div className="brand-customizer-foot">{ratio < 4.5 ? <span className="brand-warning">Contraste faible ({ratio.toFixed(1)}:1) : choisissez une couleur principale plus lisible.</span> : <span className="brand-good"><Check size={14}/> Contraste accessible</span>}<button type="button" className="brand-reset" onClick={() => onChange(defaultBrandTheme)}><RotateCcw size={13}/> Réinitialiser</button></div>
  </section>
}
