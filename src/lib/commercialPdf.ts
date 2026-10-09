import type { CommercialDocument, CompanySettings } from '../types/models'
import { jsPDF } from './pdfEngine'

export const commercialKindNames:Record<string,string>={
  BON_COMMANDE:'Bon de commande',BON_LIVRAISON:'Bon de livraison',BON_VENTE:'Bon de vente',
  BON_SORTIE:'Bon de sortie matériel',BON_ENTREE:'Bon d’entrée matériel',
  CONTRAT_CLIENT:'Projet de contrat client',OFFRE_COMMUNICATION:'Offre de communication',
  ORDRE_MISSION:'Ordre de mission',PROPOSITION_COMMERCIALE:'Proposition commerciale',
}

export const commercialDrafts:Record<string,string>={
  CONTRAT_CLIENT:'Objet du contrat :\n\nPrestations et livrables :\n\nCalendrier et jalons :\n\nPrix et modalités de règlement :\n\nObligations et validations :\n\nDurée et fin du contrat :',
  OFFRE_COMMUNICATION:'Contexte et besoins du client :\n\nObjectifs de communication :\n\nPublics visés et canaux :\n\nPrestations proposées :\n\nLivrables et calendrier :\n\nBudget et conditions :',
  ORDRE_MISSION:'Objet de la mission :\n\nLieu et dates :\n\nÉquipe mobilisée :\n\nMatériel et moyens :\n\nLivrables attendus :',
  PROPOSITION_COMMERCIALE:'Besoin exprimé :\n\nSolution proposée :\n\nPérimètre et livrables :\n\nDélais :\n\nPrix et conditions :',
}

export async function commercialPdfFile(document:CommercialDocument,company:CompanySettings|null):Promise<File>{
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const companyName=company?.company_name?.trim()||'Votre organisation'
  const kind=commercialKindNames[document.kind]||document.kind.replaceAll('_',' ')
  const client=document.clients?.name||'Client non renseigné'
  const date=(value?:string|null)=>value?new Date(value).toLocaleDateString('fr-FR'):'—'
  const price=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:document.currency==='GNF'?0:2}).format(Number(document.total||0))+' '+document.currency
  const margin=18,pageHeight=297,pageWidth=210
  let y=0,page=0
  const header=()=>{
    page+=1
    pdf.setFillColor(24,23,28);pdf.rect(0,0,pageWidth,45,'F')
    pdf.setFillColor(250,238,53);pdf.rect(margin,38,22,2,'F')
    pdf.setFont('helvetica','bold');pdf.setFontSize(16);pdf.setTextColor(255,255,255)
    pdf.text(companyName.slice(0,48),margin,22)
    pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(219,214,224)
    pdf.text((company?.address||'').slice(0,75),margin,29)
    pdf.text([company?.email,company?.phone].filter(Boolean).join(' · ').slice(0,80),margin,34)
    pdf.setFontSize(8);pdf.setTextColor(100,95,104);pdf.text(document.number,pageWidth-margin,285,{align:'right'})
    pdf.text(`Page ${page}`,margin,285)
    y=58
  }
  const ensure=(height:number)=>{if(y+height>274){pdf.addPage();header()}}
  const wrapped=(text:string,width=pageWidth-margin*2,fontSize=10,lineHeight=5.4)=>{
    pdf.setFontSize(fontSize)
    for(const paragraph of text.split('\n')){
      const lines=pdf.splitTextToSize(paragraph||' ',width) as string[]
      for(const line of lines){ensure(lineHeight);pdf.text(line,margin,y);y+=lineHeight}
      y+=paragraph?1:lineHeight/2
    }
  }
  header()
  pdf.setTextColor(32,27,36);pdf.setFont('helvetica','bold');pdf.setFontSize(20)
  const titleLines=pdf.splitTextToSize(kind,pageWidth-margin*2) as string[]
  for(const line of titleLines){pdf.text(line,margin,y);y+=9}
  y+=3
  pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(102,95,107)
  pdf.text(`N° ${document.number}  ·  Émis le ${date(document.issue_date)}`,margin,y);y+=11
  pdf.setDrawColor(222,218,225);pdf.line(margin,y,pageWidth-margin,y);y+=11
  pdf.setFont('helvetica','bold');pdf.setTextColor(43,37,48);pdf.setFontSize(9)
  pdf.text('DESTINATAIRE',margin,y);pdf.text('PROJET',112,y);y+=7
  pdf.setFont('helvetica','normal');pdf.setFontSize(11)
  pdf.text(client.slice(0,44),margin,y);pdf.text((document.projects?.name||'Sans projet').slice(0,36),112,y);y+=13
  if(document.expected_date){pdf.setFontSize(9);pdf.setTextColor(102,95,107);pdf.text(`Date prévue : ${date(document.expected_date)}`,margin,y);y+=9}
  if(Number(document.total)>0){pdf.setFillColor(246,244,247);pdf.roundedRect(margin,y,pageWidth-margin*2,18,3,3,'F');pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.setTextColor(36,30,40);pdf.text('Montant indicatif',margin+6,y+11);pdf.text(price,pageWidth-margin-6,y+11,{align:'right'});y+=27}
  pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(43,37,48);pdf.text('CONTENU DU DOCUMENT',margin,y);y+=8
  pdf.setFont('helvetica','normal');pdf.setTextColor(55,49,60)
  wrapped(document.notes?.trim()||'Aucun contenu détaillé renseigné.')
  if(document.kind==='CONTRAT_CLIENT'){
    ensure(22);y+=9;pdf.setFontSize(8);pdf.setTextColor(114,106,118)
    wrapped('Projet à relire et valider par les parties avant signature. Ce document ne vaut pas signature électronique.',pageWidth-margin*2,8,4.5)
  }
  return new File([pdf.output('blob')],`${document.number.replace(/[^A-Za-z0-9_-]/g,'-')}.pdf`,{type:'application/pdf'})
}
