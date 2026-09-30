const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('Navigating to http://localhost:3000 ...');
    // Wait until the network is mostly idle to ensure the D3 graphs have time to render
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Give it 2 extra seconds for any animations (like D3 forces) to settle
    await new Promise(r => setTimeout(r, 2000));

    console.log('Taking screenshot...');
    await page.screenshot({ path: 'rootlink_dashboard.png', fullPage: true });
    
    await browser.close();
    console.log('Screenshot saved to rootlink_dashboard.png');
  } catch (error) {
    console.error('Error taking screenshot:', error);
    process.exit(1);
  }
})();
