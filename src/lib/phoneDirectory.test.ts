import { describe, expect, it } from 'vitest'
import { contactsFromVCard, mergePhoneRecipients, selectedPhoneContacts } from './phoneDirectory'
describe('répertoire SMS',()=>{
  it('normalise et déduplique les numéros volontairement sélectionnés',()=>expect(selectedPhoneContacts([{name:['Aïssatou'],tel:['620 12 47 66','+224620124766']},{name:['Sans numéro']}])).toEqual([{name:'Aïssatou',phone:'+224620124766'}]))
  it('conserve les anciens destinataires sans les ajouter deux fois',()=>expect(mergePhoneRecipients('+224 620 12 47 66\n621000000',[{name:'A',phone:'620124766'}])).toBe('+224620124766\n+224621000000'))
  it('lit un contact vCard, les valeurs tel: et plusieurs numéros',()=>{
    expect(contactsFromVCard('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Contact QA\r\nTEL;TYPE=CELL:+224 620 12 47 66\r\nTEL;VALUE=uri:tel:+224621000000\r\nEND:VCARD')).toEqual([{name:'Contact QA',phone:'+224620124766'},{name:'Contact QA',phone:'+224621000000'}])
    expect(contactsFromVCard('texte quelconque')).toEqual([])
  })
})
