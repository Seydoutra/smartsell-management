import {jsPDF} from 'jspdf'
import type {EquipmentRequest} from '../services/equipmentRequests'
export function equipmentBonPdf(request:EquipmentRequest):File{
 if(!['SORTIE','RETOUR_PARTIEL','RETOURNEE'].includes(request.status)||!request.checked_out_at)throw new Error('Remise effective enregistrée requise pour le bon PDF.')
 const pdf=new jsPDF({unit:'mm',format:'a4'});let y=52
 const date=(value:string|null)=>value?new Date(value).toLocaleString('fr-FR',{timeZone:'Africa/Conakry'}):'Non enregistrée'
 const header=()=>{pdf.setFillColor(25,27,39);pdf.rect(0,0,210,35,'F');pdf.setTextColor(255,255,255);pdf.setFontSize(19);pdf.text('BON DE SORTIE DE MATERIEL',16,17);pdf.setFontSize(9);pdf.text(`Référence : ${request.id}`,16,26);pdf.setTextColor(25,27,39)}
 const space=(height:number)=>{if(y+height>278){pdf.addPage();header();y=47}}
 const text=(title:string,value:string)=>{pdf.setFontSize(10);const lines=pdf.splitTextToSize(value||'-',174) as string[];space(14);pdf.setFont('helvetica','bold');pdf.text(title,18,y);y+=6;pdf.setFont('helvetica','normal');for(const line of lines){space(5);pdf.setFontSize(10);pdf.text(line,18,y);y+=5}y+=5}
 header();text('Demandeur',request.requester_name);text('Mission / destination',`${request.reason} - ${request.destination}`)
 text('Décision',`Validée par ${request.decision_name||'le responsable'} le ${date(request.decision_at)}${request.decision_notes?'\n'+request.decision_notes:''}`)
 text('Remise effective',date(request.checked_out_at))
 text('Retour prévu',date(request.expected_return_at))
 for(const item of request.items){
  space(20);pdf.setDrawColor(219,222,229);pdf.line(18,y,192,y);y+=8
  text(`${item.equipment_code} - Quantité : ${item.quantity||1}`,item.equipment_name)
  text('Constat au départ',item.condition_out||'À renseigner lors de la remise avec les photos obligatoires.')
  if(item.returned_at)text('Constat au retour',`${date(item.returned_at)} - ${item.return_condition||''}\n${item.condition_in||''}`)
 }
 text('Traçabilité','Ce bon correspond à une demande validée dans votre espace. Les photos de départ et de retour sont conservées dans le dossier privé du matériel. Une autorisation ne constitue pas une remise effective.')
 for(let page=1;page<=pdf.getNumberOfPages();page++){pdf.setPage(page);pdf.setFontSize(8);pdf.setTextColor(100,104,116);pdf.text(`Bon ${request.id.slice(0,8)} | ${page}/${pdf.getNumberOfPages()}`,18,289)}
 return new File([pdf.output('blob')],`BON-SORTIE-${request.id.slice(0,8)}.pdf`,{type:'application/pdf'})
}
export function downloadEquipmentBon(request:EquipmentRequest){
 const file=equipmentBonPdf(request),url=URL.createObjectURL(file),anchor=document.createElement('a');anchor.href=url;anchor.download=file.name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000)
}
