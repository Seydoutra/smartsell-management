// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Users } from 'lucide-react'
import ModuleNavigation from './ModuleNavigation'
afterEach(cleanup)
describe('sous-menus par module',()=>{
  it('déplie le module sans changer de page et masque la création interdite',()=>{
    const navigate=vi.fn()
    render(<ModuleNavigation name="CRM & clients" icon={Users} active={false} intent={{}} onNavigate={navigate} links={[{label:'Gérer les clients',view:'CLIENTS',allowed:true},{label:'Ajouter un client',view:'CLIENTS',action:'new-client',allowed:false}]}/>)
    expect(screen.queryByText('Gérer les clients')).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'CRM & clients'}))
    expect(navigate).not.toHaveBeenCalled();expect(screen.queryByText('Ajouter un client')).toBeNull()
    fireEvent.click(screen.getByText('Gérer les clients'));expect(navigate).toHaveBeenCalledWith({view:'CLIENTS',action:undefined,request:undefined})
    fireEvent.click(screen.getByRole('button',{name:'CRM & clients'}));expect(screen.queryByText('Gérer les clients')).toBeNull()
  })
  it('ouvre une action de création avec une requête distincte à chaque clic',()=>{
    const navigate=vi.fn()
    render(<ModuleNavigation name="Factures & devis" icon={Users} active intent={{view:'DEVIS'}} onNavigate={navigate} links={[{label:'Ajouter un devis',view:'DEVIS',action:'new-document',allowed:true}]}/>)
    fireEvent.click(screen.getByText('Ajouter un devis'));fireEvent.click(screen.getByText('Ajouter un devis'))
    expect(navigate.mock.calls[0][0].request).not.toBe(navigate.mock.calls[1][0].request)
  })
})
