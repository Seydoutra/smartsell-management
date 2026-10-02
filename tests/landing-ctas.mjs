const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true })
const origin = process.env.TEST_URL || 'http://127.0.0.1:5183/'
try {
  for (const width of (process.env.TEST_WIDTHS ? process.env.TEST_WIDTHS.split(',').map(Number) : [1280, 800, 375, 320])) {
    const page = await browser.newPage({ viewport: { width, height: 800 } })
    await page.goto(origin)
    const signup = page.locator('.landing-header-actions .landing-nav-cta')
    const login = page.locator('.landing-header-actions .landing-login')
    for (const button of [signup, login]) {
      await button.waitFor({ state: 'visible' })
      const box = await button.boundingBox()
      if (!box || box.x < 0 || box.x + box.width > width + 1) throw Error(`Header action clipped at ${width}px: ${JSON.stringify(box)}`)
    }
    await signup.click()
    await page.waitForURL('**/#signup')
    await page.goto(origin)
    await login.click()
    await page.waitForURL('**/#app')
    await page.goto(origin)
    await page.locator('.landing-trial-band .landing-primary').click()
    await page.waitForURL('**/#signup')
    await page.goto(origin)
    await page.locator('.pricing-grid article.featured button').click()
    await page.waitForURL('**/#signup')
    await page.goto(origin)
    await page.locator('.landing-final-actions .landing-primary').click()
    await page.waitForURL('**/#signup')
    await page.goto(origin)
    await page.locator('.footer-bar-actions .footer-auth').first().click()
    await page.waitForURL('**/#app')
    await page.goto(origin)
    if (width <= 740) {
      await page.locator('.landing-menu').click()
      await page.locator('.landing-header nav.open').waitFor({ state: 'visible' })
      await page.locator('.landing-header nav .mobile-login').click()
      await page.waitForURL('**/#app')
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    if (overflow > 1) throw Error(`Horizontal overflow at ${width}px: ${overflow}`)
    console.log(`Landing CTAs ${width}px: sign-up, login, mid-page trial${width <= 740 ? ', mobile menu' : ''} OK`)
    await page.close()
  }
} finally { await browser.close() }
