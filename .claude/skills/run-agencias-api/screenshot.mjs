#!/usr/bin/env node
// Optional helper: screenshot the live Swagger UI of a RUNNING agencias-api.
// Start the app first (e.g. `node driver.mjs serve`), then run:
//   node screenshot.mjs <url> <out.png>
//   node screenshot.mjs http://127.0.0.1:3000/agencias/v1/api-docs swagger.png
// Uses the project's own `puppeteer` dependency (Chromium auto-downloaded on
// `npm install`). Prints {title, tagCount, out} as JSON.

import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://127.0.0.1:3000/agencias/v1/api-docs';
const out = process.argv[3] || 'swagger.png';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  // Swagger UI renders client-side; wait for the info block or a tag group.
  await page.waitForSelector('.swagger-ui .info, .swagger-ui .opblock-tag', { timeout: 30000 });
  const title = await page.title();
  const tagCount = await page.$$eval('.opblock-tag', (els) => els.length);
  await page.screenshot({ path: out, fullPage: false });
  console.log(JSON.stringify({ title, tagCount, out }));
} finally {
  await browser.close();
}
