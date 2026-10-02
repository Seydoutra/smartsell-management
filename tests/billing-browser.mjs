const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true })
try {
  for (const [width, theme] of [[1280, 'light'], [375, 'light'], [375, 'dark']]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } })
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5182/')
    await page.evaluate(async () => {
      const React = await import('/node_modules/.vite/deps/react.js')
      const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js')
      const { BillingCreateForm } = await import('/src/AdvancedModulesV3.tsx')
      document.body.innerHTML = '<div id="billing-test"></div>'
      window.__billingCalls = 0
      window.__billingError = false
      const root = (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('billing-test'))
      root.render((React.createElement || React.default.createElement)(BillingCreateForm, {
        kind: 'FACTURE',
        clients: [{ id: 'client-1', name: 'Client test' }],
        projects: [], services: [],
        create: async () => { window.__billingCalls += 1; await new Promise(resolve => setTimeout(resolve, 80)); if (window.__billingError) throw new Error('Échec réseau simulé'); return { id: 'invoice-1', number: 'FAC-TEST-001' } },
        onCreated: document => { window.__billingCreated = document.number },
      }))
    })
    await page.locator('.billing-create-form').waitFor()
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
    await page.getByRole('button', { name: 'Générer' }).click()
    if (await page.evaluate(() => window.__billingCalls) !== 0) throw Error('A form was sent without required data')
    await page.getByLabel('Client').selectOption('client-1')
    await page.getByLabel('Échéance').fill('2026-10-30')
    await page.getByLabel('Prestation').fill('Conseil digital')
    await page.getByLabel('Prix unitaire').fill('100000')
    await page.evaluate(() => { window.__billingError = true })
    await page.getByRole('button', { name: 'Générer' }).click()
    await page.getByRole('alert').getByText('Échec réseau simulé').waitFor()
    if (await page.evaluate(() => window.__billingCalls) !== 1) throw Error('Unexpected network call count')
    await page.evaluate(() => { window.__billingError = false })
    await page.getByRole('button', { name: 'Générer' }).click()
    await page.waitForFunction(() => window.__billingCreated === 'FAC-TEST-001')
    const metrics = await page.evaluate(() => {
      const input = document.querySelector('.billing-create-form input[placeholder]')
      const style = getComputedStyle(input)
      return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, activeTheme: document.documentElement.dataset.theme, inputColor: style.color, inputBackground: style.backgroundColor, calls: window.__billingCalls }
    })
    if (metrics.scrollWidth > width + 1) throw Error(`Mobile overflow at ${width}: ${metrics.scrollWidth}`)
    if (metrics.activeTheme !== theme) throw Error(`Theme changed during billing test: ${metrics.activeTheme}`)
    const rgb = value => value.match(/\d+/g).slice(0, 3).map(Number)
    const luminance = value => rgb(value).map(channel => { const s = channel / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4 }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0)
    const a = luminance(metrics.inputColor), b = luminance(metrics.inputBackground)
    metrics.contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
    if (metrics.contrast < 4.5) throw Error(`Unreadable input contrast: ${metrics.contrast}`)
    console.log(`Billing browser ${width}px ${theme}:`, metrics)
    await page.close()
  }
} finally { await browser.close() }
