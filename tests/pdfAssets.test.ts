import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { commercialPdfFile } from '../src/lib/commercialPdf'
import type { CommercialDocument } from '../src/types/models'

describe('PDF assets after deployment',()=>{
  it('loads the PDF libraries statically before a user clicks download',()=>{
    const engine=readFileSync(new URL('../src/lib/pdfEngine.ts',import.meta.url),'utf8')
    expect(engine).toMatch(/import html2canvas from 'html2canvas'/)
    expect(engine).toMatch(/import \{ jsPDF \} from 'jspdf'/)
    for(const file of ['../src/lib/invoicePdf.ts','../src/lib/commercialPdf.ts','../src/AdvancedModulesV3.tsx']){
      expect(readFileSync(new URL(file,import.meta.url),'utf8')).not.toMatch(/import\(['"](?:jspdf|html2canvas)['"]\)/)
    }
  })
  it('creates an actual PDF file for a commercial document',async()=>{
    const document={id:'test',kind:'OFFRE_COMMUNICATION',number:'TEST-001',issue_date:'2026-10-08',currency:'GNF',total:100000,notes:'Document technique fictif, sans valeur commerciale.',clients:{name:'Client de test'}} as CommercialDocument
    const file=await commercialPdfFile(document,null)
    expect(file.type).toBe('application/pdf')
    expect(file.name).toBe('TEST-001.pdf')
    expect(file.size).toBeGreaterThan(1000)
    expect((await file.text()).startsWith('%PDF-')).toBe(true)
  })
})
