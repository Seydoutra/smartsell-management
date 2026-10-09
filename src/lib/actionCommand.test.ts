import { describe, expect, it } from 'vitest'
import { commandPermission, exactCommandMatch, parseActionCommand } from './actionCommand'
describe('commandes locales bornées',()=>{
  it('prépare un client sans exécution ni identifiant inventé',()=>{
    expect(parseActionCommand('Créer un client Chérifa, email contact@exemple.com, téléphone +224620000000')).toMatchObject({kind:'CLIENT',title:'Chérifa',email:'contact@exemple.com',phone:'+224620000000'})
  })
  it('préserve les mots client/projet dans les titres et descriptions',()=>{
    expect(parseActionCommand('Créer une tâche Vérifier le projet client, description Avis du client')).toMatchObject({kind:'TASK',title:'Vérifier le projet client',description:'Avis du client'})
  })
  it('accepte le séparateur dicté et une attribution explicite',()=>{
    expect(parseActionCommand('Crée une tâche Vérifier les visuels virgule attribuer à Fatou virgule échéance 2026-12-10')).toMatchObject({kind:'TASK',assigneeName:'Fatou',date:'2026-12-10'})
  })
  it('prépare facture/devis et montants sans supposer de TVA',()=>{
    expect(parseActionCommand('Créer une facture, pour le client Alpha, service Community management, montant 700 000 GNF, sans TVA')).toMatchObject({kind:'FACTURE',clientName:'Alpha',service:'Community management',amount:700000,taxRate:0})
    expect(parseActionCommand('Créer un devis, client Alpha, prix 100 EUR, TVA 18 %')).toMatchObject({kind:'DEVIS',amount:100,currency:'EUR',taxRate:18})
  })
  it('refuse destructions, lots, champs inconnus, nombres non reconnus et informations sans séparateur',()=>{
    for(const text of ['Supprimer un client Alpha','Créer un client Alpha et créer une facture','Créer une facture, montant beaucoup','Créer une facture, distribuer 100','Créer un client Alpha email contact@exemple.com'])expect(()=>parseActionCommand(text)).toThrow()
  })
  it('ne choisit aucun compte par correspondance partielle ou ambiguë',()=>{
    const rows=[{id:'a',name:'Chérifa'},{id:'b',name:'Cherifa'},{id:'c',name:'Alpha'}]
    expect(exactCommandMatch('Cherifa',rows,row=>row.name)).toBe('')
    expect(exactCommandMatch('Al',rows,row=>row.name)).toBe('')
    expect(exactCommandMatch(' alpha ',rows,row=>row.name)).toBe('c')
    expect(commandPermission('FACTURE')).toBe('invoices.create')
  })
})
