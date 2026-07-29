#!/usr/bin/env node
// Smoke test: drives a real search + PDF export flow in a headless browser
// against both the production build (vite preview) and the dev server (vite),
// and reports every CSP violation observed in either mode. Does NOT modify
// index.html — this is a read-only diagnostic.
//
// Optional environment variables (both are ways to work around the
// unauthenticated GitHub rate limit of 60 req/h, which the live-search flow
// burns through fast — 1 search = ~16 API calls):
//   SMOKE_SNAPSHOT_ID   Loads an existing analytics_searches id via the
//                       app's own ?id= permalink instead of live-searching.
//                       Bypasses the GitHub API entirely (reads Supabase).
//   SMOKE_GITHUB_TOKEN  A real GitHub PAT, injected into the browser's
//                       localStorage exactly like SettingsModal would, so
//                       the live search actually uses it (60 -> 5,000 req/h).
//                       Read from process.env only — never prefixed VITE_,
//                       so it can never end up in the Vite bundle. Never
//                       logged anywhere in this script's output.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';

const REPO_TO_SEARCH = 'facebook/react';
const SEARCH_INPUT_SELECTOR = '#search';
const PDF_BUTTON_NAME = 'Baixar Relatório'; // src/locales/pt.json -> header.downloadButton
const APP_BASE_PATH = '/bisolhador/';
const NAV_TIMEOUT_MS = 30_000;
const DASHBOARD_TIMEOUT_MS = 60_000; // ~16 sequential/parallel unauthenticated GitHub API calls
const DOWNLOAD_TIMEOUT_MS = 30_000;

// Optional escape hatch: when the unauthenticated GitHub rate limit (60/h) is
// exhausted, set SMOKE_SNAPSHOT_ID to an existing analytics_searches id and
// the flow loads that permalink (?id=...) instead of driving a live search.
// This still exercises the exact same PDF export / html2canvas code path
// (RepoInfoCard renders identically for repoData and snapshotData), it just
// sources the data from Supabase instead of the GitHub API.
const SNAPSHOT_ID = process.env.SMOKE_SNAPSHOT_ID || null;

// Deliberately NOT prefixed VITE_ — must never be picked up by Vite's env
// replacement and end up embedded in the built bundle. Only ever read here,
// on the Node side, and passed into the browser via addInitScript below.
const GITHUB_TOKEN = process.env.SMOKE_GITHUB_TOKEN || null;

function isGaHost(url) {
  try {
    return /(^|\.)google-analytics\.com$|(^|\.)googletagmanager\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Server at ${url} did not respond within ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, 300);
        }
      });
      req.setTimeout(2000, () => req.destroy());
    };
    attempt();
  });
}

function spawnServer(command, args, { label }) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const output = [];
  child.stdout.on('data', (d) => output.push(`[${label} stdout] ${d}`));
  child.stderr.on('data', (d) => output.push(`[${label} stderr] ${d}`));
  return { child, output };
}

async function killServer(child) {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already dead */ }
      resolve();
    }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function runBrowserFlow(baseUrl, label) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'pt-BR' });
  const page = await context.newPage();

  const consoleLogs = [];
  const cspViolations = [];
  const pageErrors = [];
  const websockets = [];
  const gaRequests = [];
  const gaRequestRecordByRequest = new Map();

  // Positive proof that GA4 traffic actually left the page — a missing
  // console violation is NOT proof it wasn't blocked (CSP can silently drop
  // a request at the network layer before it ever surfaces as a violation
  // in some cases, and conversely the app may simply never have fired the
  // event this run). This only fires for requests the browser actually
  // attempted, which CSP-blocked requests to disallowed origins typically
  // never reach (they're refused before dispatch, console-only).
  page.on('request', (req) => {
    if (!isGaHost(req.url())) return;
    const record = {
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      result: 'pending',
      statusCode: null,
      failureText: null,
    };
    gaRequestRecordByRequest.set(req, record);
    gaRequests.push(record);
  });

  page.on('requestfinished', async (req) => {
    const record = gaRequestRecordByRequest.get(req);
    if (!record) return;
    try {
      const res = await req.response();
      record.result = 'succeeded';
      record.statusCode = res ? res.status() : null;
    } catch (err) {
      record.result = 'succeeded (response unavailable)';
      record.failureText = String(err && err.message ? err.message : err);
    }
  });

  page.on('requestfailed', (req) => {
    const record = gaRequestRecordByRequest.get(req);
    if (!record) return;
    record.result = 'failed';
    record.failureText = req.failure()?.errorText || null;
  });

  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (
      /content security policy/i.test(text) ||
      /refused to (load|connect|execute)/i.test(text) ||
      text.startsWith('CSP_VIOLATION_EVENT::')
    ) {
      cspViolations.push({ source: 'console', type: msg.type(), text });
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(String(err && err.stack ? err.stack : err));
  });

  page.on('websocket', (ws) => {
    const info = { url: ws.url(), error: null, closed: false, framesReceived: 0 };
    ws.on('framereceived', () => { info.framesReceived += 1; });
    ws.on('socketerror', (err) => { info.error = String(err); });
    ws.on('close', () => { info.closed = true; });
    websockets.push(info);
  });

  // Runs before ANY page script (including the very first ones), on every
  // navigation, so we don't miss early violations that a post-load
  // page.evaluate() call would have raced against.
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.log(
        'CSP_VIOLATION_EVENT::' +
          JSON.stringify({
            violatedDirective: e.violatedDirective,
            effectiveDirective: e.effectiveDirective,
            blockedURI: e.blockedURI,
            sourceFile: e.sourceFile,
            lineNumber: e.lineNumber,
            disposition: e.disposition,
          }),
      );
    });
  });

  // Mirrors exactly what a user would do manually in SettingsModal — set
  // before any navigation so the app's very first render already has the
  // token available via useRepository.js -> githubService.getHeaders().
  // Value is passed as an addInitScript argument, never interpolated into
  // a string and never logged.
  if (GITHUB_TOKEN) {
    await page.addInitScript((token) => {
      window.localStorage.setItem('github_token', token);
    }, GITHUB_TOKEN);
  }

  const usingSnapshot = Boolean(SNAPSHOT_ID);
  const flow = {
    label,
    baseUrl,
    mode: usingSnapshot ? `snapshot ?id=${SNAPSHOT_ID}` : `live search "${REPO_TO_SEARCH}"`,
    usingGithubToken: Boolean(GITHUB_TOKEN), // never the value, just whether one was injected
    navigationOk: false,
    searchSubmitted: false,
    dashboardLoaded: false,
    pdfClicked: false,
    downloadStarted: false,
    downloadFilename: null,
    error: null,
  };

  try {
    const targetPath = usingSnapshot ? `${APP_BASE_PATH}?id=${SNAPSHOT_ID}` : APP_BASE_PATH;
    await page.goto(baseUrl + targetPath, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
    });
    flow.navigationOk = true;

    if (usingSnapshot) {
      flow.searchSubmitted = true; // n/a in snapshot mode, kept for report shape consistency
    } else {
      await page.waitForSelector(SEARCH_INPUT_SELECTOR, { timeout: 15_000 });
      await page.fill(SEARCH_INPUT_SELECTOR, REPO_TO_SEARCH);
      await page.press(SEARCH_INPUT_SELECTOR, 'Enter');
      flow.searchSubmitted = true;
    }

    const pdfButton = page.getByRole('button', { name: PDF_BUTTON_NAME });
    await pdfButton.waitFor({ state: 'visible', timeout: DASHBOARD_TIMEOUT_MS });
    flow.dashboardLoaded = true;

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: DOWNLOAD_TIMEOUT_MS }),
      pdfButton.click(),
    ]);
    flow.pdfClicked = true;
    flow.downloadStarted = true;
    flow.downloadFilename = download.suggestedFilename();
  } catch (err) {
    flow.error = String(err && err.message ? err.message : err);
  }

  // Wait out any GA requests still in flight instead of a fixed timeout —
  // closing the browser while the pageview beacon is still pending produces
  // a false-negative net::ERR_ABORTED that looks like a block but isn't one.
  const gaSettleDeadline = Date.now() + 8_000;
  while (gaRequests.some((r) => r.result === 'pending') && Date.now() < gaSettleDeadline) {
    await page.waitForTimeout(200);
  }

  // Give a couple more seconds for anything else late/async (HMR ws, etc.)
  await page.waitForTimeout(2000);

  await browser.close();

  return { flow, consoleLogs, cspViolations, pageErrors, websockets, gaRequests };
}

function printReport({ flow, consoleLogs, cspViolations, pageErrors, websockets, gaRequests }, serverOutput) {
  console.log('\n' + '='.repeat(80));
  console.log(`RESULTADO: ${flow.label}`);
  console.log('='.repeat(80));
  console.log(JSON.stringify(flow, null, 2));

  console.log(`\n--- CSP violations detectadas (${cspViolations.length}) ---`);
  if (cspViolations.length === 0) {
    console.log('(nenhuma)');
  } else {
    for (const v of cspViolations) {
      console.log(JSON.stringify(v, null, 2));
    }
  }

  console.log(`\n--- Requisições para google-analytics.com/googletagmanager.com (${gaRequests.length}) ---`);
  if (gaRequests.length === 0) {
    console.log('(nenhuma — GA4 NÃO foi exercitado nesta execução; não usar como prova de que connect-src/script-src cobrem GA4)');
  } else {
    for (const r of gaRequests) {
      console.log(JSON.stringify(r, null, 2));
    }
  }

  console.log(`\n--- WebSockets observados (${websockets.length}) ---`);
  if (websockets.length === 0) {
    console.log('(nenhum)');
  } else {
    for (const ws of websockets) {
      console.log(JSON.stringify(ws, null, 2));
    }
  }

  console.log(`\n--- page errors / uncaught exceptions (${pageErrors.length}) ---`);
  if (pageErrors.length === 0) {
    console.log('(nenhum)');
  } else {
    for (const e of pageErrors) console.log(e);
  }

  console.log(`\n--- console log bruto e completo (${consoleLogs.length} mensagens) ---`);
  for (const { type, text } of consoleLogs) {
    console.log(`[${type}] ${text}`);
  }

  if (serverOutput && serverOutput.length) {
    console.log(`\n--- output do servidor (${flow.label}) ---`);
    for (const line of serverOutput) process.stdout.write(String(line));
  }
}

async function main() {
  const reports = [];

  // ---- 1) PRODUCTION BUILD (npm run build + vite preview) ----
  console.log('\n>>> Rodando npm run build...');
  await new Promise((resolve, reject) => {
    const build = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
    build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build failed with code ${code}`))));
  });

  console.log('>>> Subindo vite preview...');
  const preview = spawnServer('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { label: 'preview' });
  try {
    await waitForServer('http://localhost:4173' + APP_BASE_PATH, 20_000);
    const result = await runBrowserFlow('http://localhost:4173', 'PRODUCTION BUILD (vite preview, dist/ com CSP restritiva)');
    reports.push({ ...result, serverOutput: preview.output });
  } finally {
    await killServer(preview.child);
  }

  // ---- 2) DEV SERVER (npm run dev / vite) ----
  console.log('\n>>> Subindo vite dev server...');
  const dev = spawnServer('npx', ['vite', '--port', '5173', '--strictPort'], { label: 'dev' });
  try {
    await waitForServer('http://localhost:5173' + APP_BASE_PATH, 20_000);
    const result = await runBrowserFlow('http://localhost:5173', 'DEV SERVER (vite, mesma CSP de index.html, checando HMR/websocket)');
    reports.push({ ...result, serverOutput: dev.output });
  } finally {
    await killServer(dev.child);
  }

  for (const r of reports) {
    printReport(r, r.serverOutput);
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESUMO');
  console.log('='.repeat(80));
  for (const r of reports) {
    console.log(
      `${r.flow.label}: navigationOk=${r.flow.navigationOk} searchSubmitted=${r.flow.searchSubmitted} ` +
        `dashboardLoaded=${r.flow.dashboardLoaded} pdfClicked=${r.flow.pdfClicked} downloadStarted=${r.flow.downloadStarted} ` +
        `cspViolations=${r.cspViolations.length} gaRequests=${r.gaRequests.length} websockets=${r.websockets.length} ` +
        `pageErrors=${r.pageErrors.length} flowError=${r.flow.error ?? 'none'}`,
    );
  }
  const totalGaRequests = reports.reduce((sum, r) => sum + r.gaRequests.length, 0);
  if (totalGaRequests === 0) {
    console.log(
      '\nAVISO: 0 requisições GA4 observadas em TODOS os modos. O achado sobre connect-src/script-src ' +
        'cobrirem google-analytics.com/googletagmanager.com deve ser tratado como NÃO TESTADO, não como aprovado.',
    );
  }
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
