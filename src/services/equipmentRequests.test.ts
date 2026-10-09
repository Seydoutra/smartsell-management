import {describe,expect,it} from 'vitest'
import {validateEquipmentPhoto} from './equipmentRequests'
describe('pièces jointes de matériel',()=>{
 it('accepte les photos JPG, PNG et WebP dans la limite de 5 Mo',()=>{for(const type of ['image/jpeg','image/png','image/webp'])expect(()=>validateEquipmentPhoto({type,size:5242880} as File)).not.toThrow()});
 it('refuse les fichiers vides, trop lourds et non photographiques',()=>{for(const file of [{type:'image/jpeg',size:0},{type:'image/png',size:5242881},{type:'text/html',size:100}])expect(()=>validateEquipmentPhoto(file as File)).toThrow()});
})
