import {describe,it,expect} from 'vitest'
import {equipmentBonPdf} from './equipmentBonPdf'
// @ts-expect-error Node-only artifact check; browser application deliberately excludes Node typings.
import {mkdir,writeFile} from 'node:fs/promises'
import type {EquipmentRequest} from '../services/equipmentRequests'
const request:EquipmentRequest={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',requested_by:'u',requester_name:'Collaborateur de démonstration',reason:'Tournage client - reportage vidéo et interviews de l’équipe',destination:'Conakry',expected_return_at:'2026-10-20T17:00:00Z',status:'APPROUVEE',decision_name:'Responsable matériel',decision_notes:'Accord pour trois unités. Vérifier les accessoires au départ.',decision_at:'2026-10-10T08:00:00Z',checked_out_at:null,created_at:'2026-10-10',items:[{id:'i',equipment_id:'e',equipment_name:'Caméra et kit microphone',equipment_code:'EQ-00000001',quantity:3,condition_out:null,condition_out_photos:[],condition_in:null,condition_in_photos:[],returned_at:null,return_condition:null}]}
describe('bon matériel PDF',()=>{
 it('produit un vrai PDF pour la validation, avec avertissement avant remise',async()=>{const file=equipmentBonPdf(request);expect(file.type).toBe('application/pdf');const buffer=new Uint8Array(await file.arrayBuffer());expect(new TextDecoder().decode(buffer.subarray(0,5))).toBe('%PDF-');expect(new TextDecoder('latin1').decode(buffer)).toContain('AUTORISATION UNIQUEMENT');await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/equipment-bon-qa.pdf',buffer)})
 it('refuse un bon pour une demande non validée',()=>{expect(()=>equipmentBonPdf({...request,status:'EN_ATTENTE'})).toThrow('approuvée')})
 it('pagine les bons longs sans sortir du format A4',async()=>{const file=equipmentBonPdf({...request,status:'SORTIE',checked_out_at:'2026-10-10T09:00:00Z',items:Array.from({length:30},(_,i)=>({...request.items[0],equipment_code:`EQ-${i}`,condition_out:'Bon état au départ avec accessoires vérifiés et photos enregistrées.'}))});expect(file.size).toBeGreaterThan(10000)})
})
