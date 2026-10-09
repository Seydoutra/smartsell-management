import { html2canvas, jsPDF } from './pdfEngine'

export async function invoicePdfFile(element:HTMLElement,number:string):Promise<File> {
  const canvas=await html2canvas(element,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false})
  if(!canvas.width||!canvas.height)throw new Error('Le document est vide. Rouvrez la facture puis réessayez.')
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const pageWidth=210,pageHeight=297,imageHeight=canvas.height*pageWidth/canvas.width
  const image=canvas.toDataURL('image/png')
  let position=0,remaining=imageHeight-pageHeight
  pdf.addImage(image,'PNG',0,position,pageWidth,imageHeight,undefined,'FAST')
  while(remaining>0){position-=pageHeight;pdf.addPage();pdf.addImage(image,'PNG',0,position,pageWidth,imageHeight,undefined,'FAST');remaining-=pageHeight}
  return new File([pdf.output('blob')],`${number.replace(/[^A-Za-z0-9_-]/g,'-')}.pdf`,{type:'application/pdf'})
}
