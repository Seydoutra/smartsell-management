export type BrandTheme = {
  logoDataUrl?: string
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
}

export const defaultBrandTheme: BrandTheme = {
  primary: '#6a2b85', secondary: '#0a0a0d', accent: '#faee35',
  background: '#f4f4f6', surface: '#ffffff', text: '#17151a',
}

const STORAGE_KEY = 'smartsell-brand-theme'
const hex = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback

export function readBrandTheme(): BrandTheme {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}
    return { ...defaultBrandTheme, ...raw, primary: hex(raw.primary, defaultBrandTheme.primary), secondary: hex(raw.secondary, defaultBrandTheme.secondary), accent: hex(raw.accent, defaultBrandTheme.accent), background: hex(raw.background, defaultBrandTheme.background), surface: hex(raw.surface, defaultBrandTheme.surface), text: hex(raw.text, defaultBrandTheme.text) }
  } catch { return defaultBrandTheme }
}

export function applyBrandTheme(theme: BrandTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--brand-primary', theme.primary)
  root.style.setProperty('--brand-secondary', theme.secondary)
  root.style.setProperty('--brand-accent', theme.accent)
  root.style.setProperty('--background', theme.background)
  root.style.setProperty('--surface', theme.surface)
  root.style.setProperty('--text-primary', theme.text)
  root.dataset.brand = 'custom'
}

export function persistBrandTheme(theme: BrandTheme) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(theme))
  applyBrandTheme(theme)
}

export function contrastRatio(a: string, b: string) {
  const luminance = (value: string) => {
    const rgb = value.slice(1).match(/.{2}/g)!.map(part => parseInt(part, 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4))
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]
  }
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + .05) / (y + .05)
}

export async function extractPalette(file: File): Promise<BrandTheme> {
  const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = dataUrl })
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32
    const context = canvas.getContext('2d'); if (!context) throw new Error('canvas')
    context.drawImage(image, 0, 0, 32, 32)
    const pixels = context.getImageData(0, 0, 32, 32).data; const colors = new Map<string, number>()
    for (let i = 0; i < pixels.length; i += 4) { if (pixels[i + 3] < 150) continue; const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]].map(v => Math.round(v / 32) * 32); const key = '#' + rgb.map(v => Math.min(255, v).toString(16).padStart(2, '0')).join(''); if (!/^#(?:00){3}$|#(?:ff){3}$/i.test(key)) colors.set(key, (colors.get(key) || 0) + 1) }
    const ranked = [...colors.entries()].sort((a, b) => b[1] - a[1]).map(([color]) => color)
    return { ...defaultBrandTheme, logoDataUrl: dataUrl, primary: ranked[0] || defaultBrandTheme.primary, secondary: ranked[1] || defaultBrandTheme.secondary, accent: ranked[2] || defaultBrandTheme.accent }
  } catch { return { ...defaultBrandTheme, logoDataUrl: dataUrl } }
}
