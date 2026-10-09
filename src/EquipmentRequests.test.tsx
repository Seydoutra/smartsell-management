// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
const api=vi.hoisted(()=>({load:vi.fn(),configure:vi.fn(),submit:vi.fn(),decide:vi.fn(),checkout:vi.fn(),back:vi.fn(),upload:vi.fn(),url:vi.fn(),discard:vi.fn(),validate:vi.fn()}))
vi.mock('./services/equipmentRequests',()=>({loadEquipmentWorkspace:api.load,configureEquipmentReviewer:api.configure,submitEquipmentRequest:api.submit,decideEquipmentRequest:api.decide,checkoutEquipmentRequest:api.checkout,returnEquipmentRequest:api.back,uploadEquipmentPhoto:api.upload,getEquipmentPhotoUrl:api.url,discardEquipmentPhotos:api.discard,validateEquipmentPhoto:api.validate}))
import EquipmentRequests from './EquipmentRequests'
const item={id:'i',equipment_id:'e',equipment_name:'Caméra',equipment_code:'CAM',condition_out:'Sans rayure',condition_out_photos:[],condition_in:null,condition_in_photos:[],return_condition:null,returned_at:null}
const request={id:'req',requested_by:'u',requester_name:'Collaborateur',reason:'Tournage',destination:'Conakry',expected_return_at:'2026-12-10T10:00:00Z',status:'EN_ATTENTE',decision_name:null,decision_notes:null,decision_at:null,checked_out_at:null,created_at:'2026-10-09',items:[item]}
const workspace={can_review:false,can_configure:false,can_request:true,reviewer_id:'a',reviewer_name:'Adama',staff:[],equipment:[{id:'e',name:'Caméra',code:'CAM',condition:'Bon',available:true}],requests:[request]}
beforeEach(()=>{vi.resetAllMocks();api.load.mockResolvedValue(workspace);api.submit.mockResolvedValue('req');api.discard.mockResolvedValue(undefined);api.upload.mockResolvedValue('private/photo.jpg')})
afterEach(cleanup)
describe('bons de matériel',()=>{
 it('permet une demande sans offrir au collaborateur la validation',async()=>{
  render(<EquipmentRequests tenantOwnerId="tenant"/>);fireEvent.click(await screen.findByRole('button',{name:'Demander un bon de sortie'}));
  fireEvent.change(screen.getByLabelText('Motif / mission'),{target:{value:'Tournage'}});fireEvent.change(screen.getByLabelText('Lieu / destination'),{target:{value:'Conakry'}});fireEvent.change(screen.getByLabelText('Retour prévu (heure de Conakry)'),{target:{value:'2026-12-10T10:00'}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Transmettre la demande'}));
  await screen.findByText('Demande transmise au responsable et au propriétaire.');expect(api.submit).toHaveBeenCalledWith({reason:'Tournage',destination:'Conakry',returnAt:'2026-12-10T10:00:00.000Z',equipment:['e']});
  fireEvent.click(screen.getByText('Tournage'));expect(screen.queryByRole('button',{name:'Approuver'})).toBeNull();
 });
 it('affiche la décision seulement pour le responsable, avec refus motivé',async()=>{
  api.load.mockResolvedValue({...workspace,can_review:true});render(<EquipmentRequests tenantOwnerId="tenant"/>);fireEvent.click(await screen.findByText('Tournage'));
  expect((screen.getByRole('button',{name:'Refuser'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.change(screen.getByLabelText('Note de décision / motif de refus'),{target:{value:'Indisponible'}});fireEvent.click(screen.getByRole('button',{name:'Refuser'}));await waitFor(()=>expect(api.decide).toHaveBeenCalledWith('req',false,'Indisponible'));
 });
 it('refuse de confirmer une sortie sans photo',async()=>{
  api.load.mockResolvedValue({...workspace,can_review:true,requests:[{...request,status:'APPROUVEE'}]});render(<EquipmentRequests tenantOwnerId="tenant"/>);fireEvent.click(await screen.findByText('Tournage'));fireEvent.click(screen.getByRole('button',{name:'Enregistrer la remise + photos'}));fireEvent.click(screen.getByRole('button',{name:'Confirmer la sortie'}));await screen.findByText(/Ajoutez entre 1 et 5 photos/, {exact:false});expect(api.checkout).not.toHaveBeenCalled();
 });
 it('charge la photo et enregistre un retour dégradé avec constat',async()=>{
  api.load.mockResolvedValue({...workspace,can_review:true,requests:[{...request,status:'SORTIE'}]});render(<EquipmentRequests tenantOwnerId="tenant"/>);fireEvent.click(await screen.findByText('Tournage'));fireEvent.click(screen.getByRole('button',{name:'Enregistrer un retour + photos'}));fireEvent.click(screen.getByLabelText('Ce matériel est revenu'));fireEvent.change(screen.getByLabelText('Comparaison avec l’état au départ'),{target:{value:'DEGRADE'}});fireEvent.change(screen.getByLabelText('Observations au retour'),{target:{value:'Rayure sur objectif'}});fireEvent.change(screen.getByLabelText('Photos au retour'),{target:{files:[new File(['test'],'photo.jpg',{type:'image/jpeg'})]}});fireEvent.click(screen.getByRole('button',{name:'Confirmer le retour'}));await waitFor(()=>expect(api.back).toHaveBeenCalledWith('req',[{equipment_id:'e',notes:'Rayure sur objectif',condition:'DEGRADE',photos:['private/photo.jpg']}]));expect(api.upload).toHaveBeenCalledWith('tenant','req','e','IN',expect.any(File));
 });
 it('ne fait pas deux enregistrements lors d’un double clic',async()=>{
  api.load.mockResolvedValue({...workspace,can_review:true});api.decide.mockImplementation(()=>new Promise(()=>{}));render(<EquipmentRequests tenantOwnerId="tenant"/>);fireEvent.click(await screen.findByText('Tournage'));const button=screen.getByRole('button',{name:'Approuver'});fireEvent.click(button);fireEvent.click(button);expect(api.decide).toHaveBeenCalledTimes(1);
 });
 it('bloque les actions sur un essai expiré ou hors ligne',async()=>{
  api.load.mockResolvedValue({...workspace,can_review:true});render(<EquipmentRequests tenantOwnerId="tenant" blocked/>);expect((await screen.findByRole('button',{name:'Demander un bon de sortie'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByText('Tournage'));expect(screen.queryByRole('button',{name:'Approuver'})).toBeNull();
 });
 it('affiche l’erreur serveur sans prétendre avoir approuvé',async()=>{
  api.load.mockResolvedValue({...workspace,can_review:true});api.decide.mockRejectedValue(new Error('Matériel déjà réservé'));render(<EquipmentRequests tenantOwnerId="tenant"/>);fireEvent.click(await screen.findByText('Tournage'));fireEvent.click(screen.getByRole('button',{name:'Approuver'}));await waitFor(()=>expect(screen.getAllByRole('alert')[0].textContent).toContain('Matériel déjà réservé'));expect(screen.queryByText('Demande approuvée ; matériel réservé.')).toBeNull();
 });
})
