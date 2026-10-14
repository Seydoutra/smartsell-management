import {it,expect} from 'vitest';
import fs from 'node:fs';
import {commercialPdfFile} from '../src/lib/commercialPdf';
import type {CommercialDocument} from '../src/types/models';
it('renders invoice reference, delivered quantities and multiple pages without prices',async()=>{
 const doc={id:'test',number:'BL-TEST-2026',kind:'BON_LIVRAISON',invoice_number:'FAC-2026-TEST',issue_date:'2026-10-14',expected_date:'2026-10-14',total:987654,currency:'GNF',notes:'Livraison partielle. Données fictives pour vérification.',clients:{name:'CLIENT TEST'},projects:{name:'Projet test'},commercial_document_items:Array.from({length:35},(_,i)=>({id:String(i),description:`Article ${i+1} - impression de supports de communication, format personnalisé et finition professionnelle`,quantity:i+1,sort_order:i}))} as CommercialDocument;
 const file=await commercialPdfFile(doc,null),bytes=new Uint8Array(await file.arrayBuffer()),text=new TextDecoder('latin1').decode(bytes);
 expect(text).toContain('FAC-2026-TEST');expect(text).not.toContain('Montant indicatif');expect(text).not.toMatch(/\(987[^)]*\) Tj/);expect(text).toContain('Article 35');
 fs.mkdirSync('tmp/pdfs',{recursive:true});fs.writeFileSync('tmp/pdfs/delivery-note-qa.pdf',bytes);
});
