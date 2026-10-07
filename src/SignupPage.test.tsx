// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import SignupPage from './SignupPage'

const api = vi.hoisted(() => ({ start: vi.fn(), verify: vi.fn() }))
vi.mock('./services/supabase', () => ({ isDemoMode: false }))
vi.mock('./services/repository', () => ({
  startSmsSignupOtp: api.start, verifySmsSignupOtp: api.verify,
  resendConfirmationEmail: vi.fn(), signInWithGoogle: vi.fn(), signUpWithPassword: vi.fn(),
}))
vi.mock('./components/BrandCustomizer', () => ({ default: () => null }))

async function openCodeForm() {
  const onAccess = vi.fn()
  const view = render(<SignupPage onBack={vi.fn()} onAccess={onAccess}/>)
  const values = { fullName: 'Test Inscription', companyName: 'Test', email: 'test@example.com', phone: '+224620000000', password: 'TestPassword123', confirmation: 'TestPassword123' }
  for (const [name, value] of Object.entries(values)) {
    fireEvent.change(view.container.querySelector(`input[name="${name}"]`)!, { target: { value } })
  }
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.submit(view.container.querySelector('form')!)
  const code = await screen.findByLabelText('Code reçu par SMS') as HTMLInputElement
  const button = screen.getByRole('button', { name: /Valider et créer/ }) as HTMLButtonElement
  return { code, button, form: code.closest('form')!, onAccess }
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  api.start.mockResolvedValue({ challenge_id: 'test-challenge' })
  api.verify.mockResolvedValue({ success: true, email: 'test@example.com' })
})
afterEach(cleanup)

describe('inscription par SMS', () => {
  it('rend le champ et la validation accessibles dès la réception du challenge', async () => {
    const { code, button } = await openCodeForm()
    expect(code.disabled).toBe(false)
    expect(code.readOnly).toBe(false)
    expect(document.activeElement).toBe(code)
    expect(button.disabled).toBe(false)
    expect(code.autocomplete).toBe('one-time-code')
  })

  it('accepte un code collé avec espaces et conserve le zéro initial', async () => {
    const { code, form, onAccess } = await openCodeForm()
    fireEvent.change(code, { target: { value: '012 345' } })
    expect(code.value).toBe('012345')
    fireEvent.submit(form)
    await screen.findByText('Votre compte est créé.')
    expect(api.verify).toHaveBeenCalledWith(expect.objectContaining({ code: '012345', challengeId: 'test-challenge' }))
    expect(onAccess).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }))
    expect(onAccess).toHaveBeenCalledOnce()
  })

  it('refuse un code incomplet sans bloquer le formulaire', async () => {
    const { code, form, button } = await openCodeForm()
    fireEvent.change(code, { target: { value: '12' } })
    fireEvent.submit(form)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('6 chiffres'))
    expect(api.verify).not.toHaveBeenCalled()
    expect(button.disabled).toBe(false)
  })

  it('empêche les doubles validations mais laisse la saisie accessible', async () => {
    let resolve!: (value: { success: boolean; email: string }) => void
    api.verify.mockImplementation(() => new Promise(done => { resolve = done }))
    const { code, form, button } = await openCodeForm()
    fireEvent.change(code, { target: { value: '123456' } })
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(api.verify).toHaveBeenCalledOnce()
    expect(button.disabled).toBe(true)
    expect(code.disabled).toBe(false)
    resolve({ success: true, email: 'test@example.com' })
    await screen.findByText('Votre compte est créé.')
  })

  it('permet de corriger et réessayer après une erreur du serveur', async () => {
    api.verify.mockRejectedValueOnce(new Error('Code incorrect ou expiré.'))
    const { code, form, button } = await openCodeForm()
    fireEvent.change(code, { target: { value: '123456' } })
    fireEvent.submit(form)
    await screen.findByRole('alert')
    await waitFor(() => expect(button.disabled).toBe(false))
    fireEvent.change(code, { target: { value: '654321' } })
    fireEvent.submit(form)
    await screen.findByText('Votre compte est créé.')
    expect(api.verify).toHaveBeenCalledTimes(2)
  })

  it('ne présente pas de faux succès si la vérification échoue', async () => {
    api.verify.mockResolvedValue({ success: false })
    const { code, form, button } = await openCodeForm()
    fireEvent.change(code, { target: { value: '123456' } })
    fireEvent.submit(form)
    await screen.findByRole('alert')
    expect(screen.queryByText('Votre compte est créé.')).toBeNull()
    expect(button.disabled).toBe(false)
  })
})
