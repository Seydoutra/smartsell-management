// Self-contained A4 stylesheet. Also used when the browser cannot reload CSS.
export default `
[data-invoice-export]{font:14px/1.5 Arial,sans-serif!important;color:#18151b!important;background:#fff!important;text-align:left!important}
[data-invoice-export] *{box-sizing:border-box;animation:none!important;transition:none!important;max-width:none;font-family:Arial,sans-serif!important;font-kerning:none!important;letter-spacing:0!important;word-spacing:normal!important}
[data-invoice-export] .invoice-sheet{display:block!important;width:794px!important;max-width:none!important;min-width:0!important;background:#fff!important;color:#18151b!important;padding:36px!important;margin:0!important;border-radius:0!important;position:relative!important;overflow:visible!important}
[data-invoice-export] .invoice-accent{position:absolute;left:0;top:0;right:0;height:7px;background:#6a2b85}
[data-invoice-export] .invoice-brand{display:flex!important;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #18151b;padding-bottom:18px;gap:20px}
[data-invoice-export] .invoice-brand img{display:block!important;width:150px!important;height:100px!important;max-width:150px!important;object-fit:contain;background:#0a0a0d;border-radius:8px;flex:none}
[data-invoice-export] .invoice-brand div{text-align:right;flex:1;min-width:0}
[data-invoice-export] .invoice-brand strong,[data-invoice-export] .invoice-brand span{display:block}
[data-invoice-export] .invoice-brand strong{font-size:18px;color:#18151b}
[data-invoice-export] .invoice-brand span{font-size:11px;color:#514b56;line-height:1.6;overflow-wrap:anywhere}
[data-invoice-export] .invoice-title-row{display:flex;justify-content:space-between;align-items:center;margin:28px 0 4px;gap:20px}
[data-invoice-export] .invoice-title-row small{font-size:10px;color:#6a2b85;font-weight:700}
[data-invoice-export] .invoice-title-row h2{font-size:30px;line-height:1.2;margin:4px 0;color:#18151b}
[data-invoice-export] .status{display:inline-block;padding:7px 10px;border:1px solid #ddd;border-radius:8px;font-size:11px;white-space:nowrap;color:#18151b;background:#f4f4f6}
[data-invoice-export] .status.danger{color:#a51c30!important;background:#fce9ed!important;border-color:#efb6c0}
[data-invoice-export] .status.warning{color:#8b5600!important;background:#fff3d6!important;border-color:#e9c77f}
[data-invoice-export] .status.success{color:#14663e!important;background:#e5f6ec!important;border-color:#a2d6b7}
[data-invoice-export] .status.pending{color:#6941a5!important;background:#f0eafa!important}
[data-invoice-export] .status.progress,[data-invoice-export] .status.info{color:#175d9d!important;background:#e5f1fc!important}
[data-invoice-export] .invoice-meta{display:grid!important;grid-template-columns:1fr 1fr!important;gap:40px;margin:26px 0}
[data-invoice-export] .invoice-meta>div:last-child{text-align:right}
[data-invoice-export] .invoice-meta small,[data-invoice-export] .invoice-meta strong,[data-invoice-export] .invoice-meta span{display:block}
[data-invoice-export] .invoice-meta small{font-size:10px;color:#6a2b85;font-weight:700}
[data-invoice-export] .invoice-meta strong{font-size:15px;color:#18151b;margin:6px 0}
[data-invoice-export] .invoice-meta span{font-size:11px;color:#514b56}
[data-invoice-export] table{display:table!important;width:100%!important;min-width:0!important;border-collapse:collapse!important;font-size:12px;table-layout:fixed;color:#18151b}
[data-invoice-export] th{background:#f4f4f6!important;color:#18151b!important;font-weight:700;text-align:left}
[data-invoice-export] th,[data-invoice-export] td{padding:10px 8px;border-bottom:1px solid #ece9ee;overflow-wrap:anywhere}
[data-invoice-export] th:first-child,[data-invoice-export] td:first-child{width:42%;text-align:left}
[data-invoice-export] th:not(:first-child),[data-invoice-export] td:not(:first-child){text-align:right}
[data-invoice-export] .invoice-total{display:grid!important;grid-template-columns:1fr auto!important;width:310px!important;margin:20px 0 0 auto!important;gap:9px;padding-top:18px;border-top:2px solid #18151b;font-size:12px;color:#18151b}
[data-invoice-export] .invoice-total strong{font-size:15px;color:#18151b}
[data-invoice-export] .invoice-payment-note{font-size:12px;margin-top:16px;color:#514b56}
[data-invoice-export] .invoice-authentication{display:flex!important;justify-content:space-between;align-items:flex-end;gap:20px;margin-top:24px;min-height:110px}
[data-invoice-export] .invoice-stamp img{display:block!important;width:125px!important;height:125px!important;max-width:125px!important;object-fit:contain}
[data-invoice-export] .invoice-qr-block{display:flex!important;align-items:center;gap:10px;margin-left:auto;width:310px;max-width:310px;border:1px solid #e5dfe9;border-radius:10px;padding:8px}
[data-invoice-export] .invoice-qr{display:block!important;width:88px!important;height:88px!important;max-width:88px!important;flex:none;object-fit:contain}
[data-invoice-export] .invoice-qr-block div{display:grid;gap:4px;flex:1;min-width:0}
[data-invoice-export] .invoice-qr-block strong{font-size:11px;color:#25202a}
[data-invoice-export] .invoice-qr-block span{font-size:10px;line-height:1.45;color:#514b56}
[data-invoice-export] .invoice-qr-block a{color:#6a2b85;overflow-wrap:anywhere}
[data-invoice-export] .invoice-footer{display:flex!important;justify-content:space-between;gap:20px;margin-top:16px;padding-top:12px;border-top:1px solid #ece9ee;font-size:10px;color:#514b56}
[data-invoice-export] .invoice-footer strong{color:#6a2b85}
`
