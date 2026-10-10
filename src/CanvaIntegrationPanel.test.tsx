// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
const api=vi.hoisted(()=>({action:vi.fn()}))
vi.mock('./services/repository',()=>({canvaAction:api.action}))
import CanvaIntegrationPanel from './CanvaIntegrationPanel'
afterEach(()=>{cleanup();vi.resetAllMocks()})
describe('Canva connection status',()=>{
  it('does not announce disconnection while the status request is pending',()=>{
    api.action.mockReturnValue(new Promise(()=>{}))
    render(<CanvaIntegrationPanel canManage />)
    expect(screen.getByRole('status').textContent).toContain('Vérification')
    expect(screen.queryByText('Non connecté')).toBeNull()
    expect(screen.queryByRole('button',{name:'Autoriser Canva'})).toBeNull()
  })
  it('shows a confirmed owner connection and its actions',async()=>{
    api.action.mockResolvedValue({connected:true,configured:true,canManage:true,sharedConnected:true,accessGranted:true})
    render(<CanvaIntegrationPanel canManage />)
    await screen.findByText('Connecté par Canva')
    expect(screen.getByRole('button',{name:'Afficher mes créations'})).toBeTruthy()
  })
  it('does not misrepresent a failed status request as a disconnected account',async()=>{
    api.action.mockRejectedValue(new Error('Connexion indisponible'))
    render(<CanvaIntegrationPanel canManage />)
    await screen.findByRole('alert')
    expect(screen.queryByText('Non connecté')).toBeNull()
    expect(screen.queryByText(/Le propriétaire de cet espace peut connecter/)).toBeNull()
  })
})
