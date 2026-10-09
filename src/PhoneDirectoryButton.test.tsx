// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PhoneDirectoryButton from './PhoneDirectoryButton'
afterEach(()=>{cleanup();Object.defineProperty(navigator,'contacts',{value:undefined,configurable:true});Object.defineProperty(window,'isSecureContext',{value:false,configurable:true})})
describe('bouton Répertoire à côté des destinataires',()=>{
  it('ouvre immédiatement le sélecteur natif sur un appareil compatible',async()=>{
    const select=vi.fn().mockResolvedValue([{name:['Contact QA'],tel:['620124766']}]),selected=vi.fn()
    Object.defineProperty(navigator,'contacts',{value:{select},configurable:true});Object.defineProperty(window,'isSecureContext',{value:true,configurable:true})
    render(<PhoneDirectoryButton onSelected={selected}/>);fireEvent.click(screen.getByRole('button',{name:'Ouvrir le répertoire du téléphone'}))
    expect(select).toHaveBeenCalledWith(['name','tel'],{multiple:true});await screen.findByText('1 numéro(s) ajouté(s).')
    expect(selected).toHaveBeenCalledWith([{name:'Contact QA',phone:'+224620124766'}])
  })
  it('ne prétend pas ouvrir Contacts sur un navigateur incompatible',()=>{
    render(<PhoneDirectoryButton onSelected={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Ouvrir le répertoire du téléphone'}))
    expect(screen.getByText(/Ce navigateur ne permet pas l’accès direct/)).toBeTruthy();expect(screen.getByText('Importer un contact (.vcf)')).toBeTruthy()
  })
  it('annule sans ajouter de destinataire quand l’utilisateur refuse',async()=>{
    const selected=vi.fn();Object.defineProperty(navigator,'contacts',{value:{select:vi.fn().mockRejectedValue(new DOMException('Refus','AbortError'))},configurable:true});Object.defineProperty(window,'isSecureContext',{value:true,configurable:true})
    render(<PhoneDirectoryButton onSelected={selected}/>);fireEvent.click(screen.getByRole('button',{name:'Ouvrir le répertoire du téléphone'}))
    await screen.findByText('Sélection annulée.');expect(selected).not.toHaveBeenCalled()
  })
})
