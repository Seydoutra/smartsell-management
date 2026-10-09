import { beforeEach, describe, expect, it, vi } from 'vitest'
const engine=vi.hoisted(()=>({capture:vi.fn(),addImage:vi.fn(),addPage:vi.fn(),output:vi.fn()}))
vi.mock('./pdfEngine',()=>({html2canvas:engine.capture,jsPDF:class {
  addImage=engine.addImage;addPage=engine.addPage;output=engine.output
}}))
import { invoicePdfFile } from './invoicePdf'
const element={} as HTMLElement
beforeEach(()=>{vi.clearAllMocks();engine.capture.mockResolvedValue({width:794,height:500,toDataURL:()=> 'data:image/png;base64,test'});engine.output.mockReturnValue(new Blob(['%PDF-test']))})
describe('invoice PDF download pipeline',()=>{
  it('renders a file without making a lazy module request',async()=>{
    const file=await invoicePdfFile(element,'FAC/001')
    expect(engine.capture).toHaveBeenCalledWith(element,expect.objectContaining({scale:2,backgroundColor:'#ffffff'}))
    expect(file.name).toBe('FAC-001.pdf');expect(file.type).toBe('application/pdf')
    expect(engine.addPage).not.toHaveBeenCalled()
  })
  it('includes all pages of a long document',async()=>{
    engine.capture.mockResolvedValue({width:794,height:2500,toDataURL:()=> 'data:image/png;base64,test'})
    await invoicePdfFile(element,'FAC-002')
    expect(engine.addPage).toHaveBeenCalledTimes(2);expect(engine.addImage).toHaveBeenCalledTimes(3)
  })
  it('reports an empty rendering rather than downloading a blank file',async()=>{
    engine.capture.mockResolvedValue({width:0,height:0})
    await expect(invoicePdfFile(element,'FAC-003')).rejects.toThrow(/document est vide/)
    expect(engine.output).not.toHaveBeenCalled()
  })
  it('does not report a successful download when rendering failed',async()=>{
    engine.capture.mockRejectedValue(new Error('Rendu impossible'))
    await expect(invoicePdfFile(element,'FAC-004')).rejects.toThrow('Rendu impossible')
    expect(engine.output).not.toHaveBeenCalled()
  })
})
