import { html2canvas, jsPDF } from './pdfEngine'
import exportStyles from './invoicePdfExport'

export async function invoicePdfFile(element:HTMLElement,number:string):Promise<File> {
  if(element.ownerDocument?.fonts?.ready)await element.ownerDocument.fonts.ready
  const canvas=await html2canvas(element,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false,windowWidth:1200,scrollX:0,scrollY:0,
    onclone:(clonedDocument,clonedElement)=>{
      // Embed the export layout: cloned external stylesheets can fail to load
      // in long-lived tabs after a deployment. Never export intrinsic image sizes.
      const style=clonedDocument.createElement('style');style.textContent=exportStyles;clonedDocument.head.appendChild(style)
      clonedElement.setAttribute('data-invoice-export','true')
      clonedDocument.body.appendChild(clonedElement)
      Object.assign(clonedElement.style,{position:'absolute',left:'0',top:'0',width:'794px',maxWidth:'none',height:'auto',overflow:'visible',transform:'none',margin:'0'})
      const tones:Record<string,[string,string]>={danger:['#a51c30','#fce9ed'],warning:['#8b5600','#fff3d6'],success:['#14663e','#e5f6ec']}
      clonedElement.querySelectorAll<HTMLElement>('.status').forEach(badge=>{
        const tone=Object.keys(tones).find(name=>badge.classList.contains(name))
        if(tone){badge.style.setProperty('color',tones[tone][0],'important');badge.style.setProperty('background-color',tones[tone][1],'important')}
      })
    }})
  if(!canvas.width||!canvas.height)throw new Error('Le document est vide. Rouvrez la facture puis réessayez.')
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const pageWidth=210,pageHeight=297,imageHeight=canvas.height*pageWidth/canvas.width
  const image=canvas.toDataURL('image/png')
  let position=0,remaining=imageHeight-pageHeight
  pdf.addImage(image,'PNG',0,position,pageWidth,imageHeight,undefined,'FAST')
  while(remaining>0){position-=pageHeight;pdf.addPage();pdf.addImage(image,'PNG',0,position,pageWidth,imageHeight,undefined,'FAST');remaining-=pageHeight}
  return new File([pdf.output('blob')],`${number.replace(/[^A-Za-z0-9_-]/g,'-')}.pdf`,{type:'application/pdf'})
}
