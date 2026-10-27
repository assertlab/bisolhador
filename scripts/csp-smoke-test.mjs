#!/usr/bin/env node
// Smoke test: drives a real search + PDF export flow in a headless browser
// against both the production build (vite preview) and the dev server (vite),
// and reports every CSP violation observed in either mode. Does NOT modify
// index.html. It is a pass/fail gate (exit code below), and it changes the
// network behavior under test in one way only:
//
// Never writes to production: Supabase registrar_busca (save-on-load) and
// GA4 collection hits are intercepted and answered locally. CSP is still
// fully exercised — the browser enforces CSP before a request reaches
// Playwright's route handler, so a blocked origin still shows up as a
// violation and an allowed one is still recorded in gaRequests.
//
// Second flow (Classroom report, since v3.18): /turma with a mocked GitHub API
// (one repository; every other call fails, which the page shows as n/d) and a
// fake token that never leaves the page, then the "Relatório PDF" button. It
// guards what only a real browser under the real CSP shows: react-pdf's
// WebAssembly layout (script-src 'wasm-unsafe-eval' + connect-src data:) and
// the blob worker a PNG image would spawn (it hangs the report, silently).
//
// Exit code: 0 only if every mode navigated, loaded the dashboard, produced the
// Dashboard and the Classroom PDF reports (valid PDFs, report font embedded), and had zero CSP violations
// and zero page errors. With
// SMOKE_REQUIRE_GA=1 (set in CI), zero GA4 requests also fails: GA4's CSP
// coverage would otherwise go untested silently (e.g. VITE_GA_ID missing).
// Runs in CI (.github/workflows/ci.yml, job "smoke") in snapshot mode; it
// depends on SMOKE_SNAPSHOT_ID existing in production Supabase. Snapshot mode
// also opens the semantic permalink (?repo=&date=) for that same record
// (buscar_snapshot_por_data, which returned null for everything until 2026-10).
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
import { readFileSync } from 'node:fs';

const REPO_TO_SEARCH = 'facebook/react';
const SEARCH_INPUT_SELECTOR = '#search';
const PDF_BUTTON_NAME = 'Baixar Relatório'; // src/locales/pt.json -> header.downloadButton
const APP_BASE_PATH = '/';
const NAV_TIMEOUT_MS = 30_000;
const DASHBOARD_TIMEOUT_MS = 60_000; // ~16 sequential/parallel unauthenticated GitHub API calls
const DOWNLOAD_TIMEOUT_MS = 60_000; // react-pdf (~1.2 MB) + fonts + layout on a CI runner
const CLASSROOM_REPORT_BUTTON_NAME = 'Relatório PDF'; // src/locales/pt.json -> classroom.report.button
const CLASSROOM_URL = '/turma?repos=smoke-org/smoke-repo&from=2026-08-01&to=2026-10-26';
// Pages the strict policy (no inline styles, no data: images) has to survive besides the two PDF flows:
// every route, loaded cold, so a library injecting <style> or a data: image shows up as a violation.
// Each route has a landmark that must render (a crash into the error page or a chunk failure raises no
// pageerror, so without it a broken route would count as visited); benchmark has no heading before a repo is added.
const OTHER_ROUTES = [
  ['/ranking', 'h1'],
  ['/benchmark', 'main'],
  ['/timeline/facebook/react', 'h1'],
  ['/guia', 'main h1'],
  ['/guia/ia', 'main h1'],
];
const OTHER_ROUTE_SETTLE_MS = 1_500; // after the landmark: lets lazy charts and tooltips mount
const OTHER_ROUTE_LANDMARK_TIMEOUT_MS = 20_000;
const CLASSROOM_REPORT_TIMEOUT_MS = 90_000; // react-pdf (~1.2 MB) + fonts + layout on a CI runner

// Optional escape hatch: when the unauthenticated GitHub rate limit (60/h) is
// exhausted, set SMOKE_SNAPSHOT_ID to an existing analytics_searches id and
// the flow loads that permalink (?id=...) instead of driving a live search.
// This still exercises the exact same PDF report code path
// (RepoInfoCard renders identically for repoData and snapshotData), it just
// sources the data from Supabase instead of the GitHub API.
const SNAPSHOT_ID = process.env.SMOKE_SNAPSHOT_ID || null;

// Deliberately NOT prefixed VITE_ — must never be picked up by Vite's env
// replacement and end up embedded in the built bundle. Only ever read here,
// on the Node side, and passed into the browser via addInitScript below.
const GITHUB_TOKEN = process.env.SMOKE_GITHUB_TOKEN || null;

// Same GA4 hosts the CSP allows (index.html): *.google-analytics.com,
// *.analytics.google.com (regional collection, e.g. region1.) and
// googletagmanager.com.
function isGaHost(url) {
  try {
    return /(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$|(^|\.)googletagmanager\.com$/i.test(new URL(url).hostname);
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

// Own process group (detached) so killServer can stop the whole tree. Killing
// only the direct child left the real vite process (and its stdout pipe)
// alive on Linux, which kept this script from ever exiting in CI.
function spawnServer(command, args, { label }) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const output = [];
  child.stdout.on('data', (d) => output.push(`[${label} stdout] ${d}`));
  child.stderr.on('data', (d) => output.push(`[${label} stderr] ${d}`));
  return { child, output };
}

async function killServer(child) {
  if (!child || child.exitCode !== null) return;
  const killGroup = (signal) => {
    try { process.kill(-child.pid, signal); } catch { /* group already gone */ }
  };
  killGroup('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      killGroup('SIGKILL');
      resolve();
    }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  child.stdout?.destroy();
  child.stderr?.destroy();
}

// GitHub API stand-in for the Classroom flow. One repository (public, so the privacy gate passes);
// empty runs and releases; everything else (GraphQL, search) answers 500, so those parts show n/d.
// api.github.com is cross-origin from localhost: answer the preflight, echoing the requested headers
// (a '*' wildcard does not cover Authorization).
async function mockGithubApi(page) {
  await page.route('https://api.github.com/**', (route) => {
    const request = route.request();
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': request.headers()['access-control-request-headers'] ?? '*',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const { pathname } = new URL(request.url());
    let body = null;
    if (pathname === '/repos/smoke-org/smoke-repo') body = { full_name: 'smoke-org/smoke-repo', private: false, default_branch: 'main' };
    else if (pathname.endsWith('/actions/runs')) body = { total_count: 0, workflow_runs: [] };
    else if (pathname.endsWith('/releases')) body = [];
    if (!body) return route.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: '{"message":"smoke: not mocked"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
  });
}

// States a cold page load never shows: tooltips, the settings modal, the theme switch. Strict style-src
// (no inline styles) must hold there too; a violation is caught by the console listener. Every step is
// required: a selector that stops matching fails the run instead of silently skipping the check.
// Runs on the Dashboard the flow already loaded (live search or snapshot), so it works in both modes.
async function exerciseInteractiveStates(page) {
  await page.getByRole('button', { name: PDF_BUTTON_NAME }).waitFor({ state: 'visible', timeout: DASHBOARD_TIMEOUT_MS });
  const tips = (await page.locator('svg.cursor-help').all()).slice(0, 6);
  if (tips.length === 0) throw new Error('no tooltip icon (svg.cursor-help) on the Dashboard: selector out of date');
  for (const tip of tips) {
    await tip.hover({ timeout: 5_000 });
    await page.waitForTimeout(150);
  }
  await page.getByRole('button', { name: /configura/i }).first().click({ timeout: 5_000 }); // pt-BR: header settings button
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  const themeToggle = page.locator('button[title*="tema"]').first(); // pt-BR: "Mudar para tema escuro/claro"
  await themeToggle.click({ timeout: 5_000 });
  await page.waitForTimeout(500);
  await page.locator('button[title*="tema"]').first().click({ timeout: 5_000 }); // back to the original theme
}

async function runClassroomReportFlow(page, baseUrl) {
  await mockGithubApi(page);
  // Classroom only runs with a token. A fake one: every api.github.com request is answered above, none leaves the page.
  await page.evaluate(() => window.localStorage.setItem('github_token', 'smoke-fake-token'));
  await page.goto(baseUrl + CLASSROOM_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  const reportButton = page.getByRole('button', { name: CLASSROOM_REPORT_BUTTON_NAME });
  await reportButton.waitFor({ state: 'visible', timeout: DASHBOARD_TIMEOUT_MS });
  // click() waits for the button to be enabled (disabled while the analysis runs)
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: CLASSROOM_REPORT_TIMEOUT_MS }),
    reportButton.click({ timeout: CLASSROOM_REPORT_TIMEOUT_MS }),
  ]);
  return inspectPdfDownload(download);
}

// A report is only a report if it is a real PDF with the report font embedded (a failed font load
// would fall back silently otherwise)
async function inspectPdfDownload(download) {
  const bytes = readFileSync(await download.path());
  const text = bytes.toString('latin1');
  return {
    filename: download.suggestedFilename(),
    bytes: bytes.length,
    pdf: text.startsWith('%PDF'),
    fonts: ['IBMPlexSans-Regular', 'IBMPlexSans-SemiBold'].every((name) => text.includes(name)),
  };
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
  const writesIntercepted = { registrar_busca: 0, ga4: 0 };

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

  // No production writes from a test run (see header). Only the collection
  // endpoints are stubbed — gtag.js itself still loads, so script-src and
  // the request-side CSP checks stay real.
  // Supabase is cross-origin from localhost: without CORS headers Chromium
  // rejects the fulfilled response, and supabase-js would see a network
  // error instead of this stub (a different path than real users get).
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  await page.route('**/rest/v1/rpc/registrar_busca', (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }
    writesIntercepted.registrar_busca += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', headers: corsHeaders, body: 'null' });
  });
  await page.route((url) => isGaHost(url.href) && /\/(collect|td)\/?$/.test(url.pathname), (route) => {
    writesIntercepted.ga4 += 1;
    return route.fulfill({ status: 204, body: '' });
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
    datePermalink: null, // snapshot mode: ?repo=&date= of the same record
    datePermalinkOk: usingSnapshot ? false : null,
    routesVisited: [],
    interactiveStates: false,
    dashboardReport: null, // { filename, bytes, pdf, fonts } of the Dashboard report download
    classroomReport: null, // { filename, bytes, pdf, fonts } once the report was generated
    error: null,
  };

  // obter_snapshot's answer gives the repo and date for the semantic permalink.
  let snapshotRecord = null;
  if (usingSnapshot) {
    page.on('response', async (res) => {
      if (!res.url().includes('/rest/v1/rpc/obter_snapshot') || res.request().method() !== 'POST') return;
      try {
        snapshotRecord = await res.json();
      } catch {
        // reported below as datePermalinkOk=false
      }
    });
  }

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
    flow.dashboardReport = await inspectPdfDownload(download);

    if (usingSnapshot) {
      if (!snapshotRecord?.repo_name || !snapshotRecord?.created_at) throw new Error('obter_snapshot response not captured');
      // Same fixed timezone as the RPC (supabase-migrations/buscar_snapshot_por_data.sql)
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife' }).format(new Date(snapshotRecord.created_at));
      flow.datePermalink = `?repo=${snapshotRecord.repo_name}&date=${date}`;
      await page.goto(baseUrl + APP_BASE_PATH + flow.datePermalink, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
      await page.getByRole('button', { name: PDF_BUTTON_NAME }).waitFor({ state: 'visible', timeout: DASHBOARD_TIMEOUT_MS });
      flow.datePermalinkOk = true;
    }

    flow.routesVisited = [];
    await exerciseInteractiveStates(page); // before leaving the Dashboard page
    flow.interactiveStates = true;

    for (const [route, landmark] of OTHER_ROUTES) {
      await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
      await page.locator(landmark).first().waitFor({ state: 'visible', timeout: OTHER_ROUTE_LANDMARK_TIMEOUT_MS });
      await page.waitForTimeout(OTHER_ROUTE_SETTLE_MS);
      flow.routesVisited.push(route);
    }

    flow.classroomReport = await runClassroomReportFlow(page, baseUrl);
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

  return { flow, consoleLogs, cspViolations, pageErrors, websockets, gaRequests, writesIntercepted };
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
  const preview = spawnServer('node_modules/.bin/vite', ['preview', '--port', '4173', '--strictPort'], { label: 'preview' });
  try {
    await waitForServer('http://localhost:4173' + APP_BASE_PATH, 20_000);
    const result = await runBrowserFlow('http://localhost:4173', 'PRODUCTION BUILD (vite preview, dist/ com CSP restritiva)');
    reports.push({ ...result, serverOutput: preview.output });
  } finally {
    await killServer(preview.child);
  }

  // ---- 2) DEV SERVER (npm run dev / vite) ----
  console.log('\n>>> Subindo vite dev server...');
  const dev = spawnServer('node_modules/.bin/vite', ['--port', '5173', '--strictPort'], { label: 'dev' });
  try {
    await waitForServer('http://localhost:5173' + APP_BASE_PATH, 20_000);
    const result = await runBrowserFlow('http://localhost:5173', 'DEV SERVER (vite, style-src relaxado so no dev, checando HMR/websocket)');
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
        `dashboardLoaded=${r.flow.dashboardLoaded} pdfClicked=${r.flow.pdfClicked} downloadStarted=${r.flow.downloadStarted} datePermalinkOk=${r.flow.datePermalinkOk} ` +
        `routes=${r.flow.routesVisited.length}/${OTHER_ROUTES.length} interactive=${r.flow.interactiveStates} ` +
        `dashboardReport=${r.flow.dashboardReport ? `${r.flow.dashboardReport.bytes}B` : 'none'} classroomReport=${r.flow.classroomReport ? `${r.flow.classroomReport.bytes}B` : 'none'} ` +
        `cspViolations=${r.cspViolations.length} gaRequests=${r.gaRequests.length} websockets=${r.websockets.length} ` +
        `pageErrors=${r.pageErrors.length} intercepted=${JSON.stringify(r.writesIntercepted)} ` +
        `flowError=${r.flow.error ?? 'none'}`,
    );
  }
  const totalGaRequests = reports.reduce((sum, r) => sum + r.gaRequests.length, 0);
  if (totalGaRequests === 0) {
    console.log(
      '\nAVISO: 0 requisições GA4 observadas em TODOS os modos. O achado sobre connect-src/script-src ' +
        'cobrirem google-analytics.com/googletagmanager.com deve ser tratado como NÃO TESTADO, não como aprovado.',
    );
  }

  const failures = reports.flatMap((r) => {
    const f = r.flow;
    const problems = [];
    if (!f.navigationOk) problems.push('navigation');
    if (!f.dashboardLoaded) problems.push('dashboard did not load');
    if (!f.downloadStarted) problems.push('PDF download did not start');
    if (f.datePermalinkOk === false) problems.push(`date permalink ${f.datePermalink ?? '(not built)'} did not load (buscar_snapshot_por_data)`);
    for (const [name, report] of [['Dashboard', f.dashboardReport], ['Classroom', f.classroomReport]]) {
      if (!report) problems.push(`${name} PDF report was not generated`);
      else if (!report.pdf || !report.fonts || report.bytes < 5000) problems.push(`${name} PDF report is not a valid PDF with the embedded fonts (${JSON.stringify(report)})`);
    }
    if (!f.interactiveStates) problems.push('interactive states (tooltips, settings modal, theme) were not exercised');
    if (f.routesVisited.length !== OTHER_ROUTES.length) problems.push(`only ${f.routesVisited.length} of ${OTHER_ROUTES.length} extra routes were visited`);
    if (r.cspViolations.length) problems.push(`${r.cspViolations.length} CSP violation(s)`);
    if (r.pageErrors.length) problems.push(`${r.pageErrors.length} page error(s)`);
    return problems.map((p) => `${f.label}: ${p}`);
  });
  if (process.env.SMOKE_REQUIRE_GA === '1' && totalGaRequests === 0) {
    failures.push('0 GA4 requests in every mode (SMOKE_REQUIRE_GA=1): is VITE_GA_ID set?');
  }
  if (failures.length) {
    console.log('\nFALHOU:\n  ' + failures.join('\n  '));
    if (failures.some((f) => f.includes('dashboard did not load')) && SNAPSHOT_ID) {
      console.log(`  (snapshot mode: confirm analytics_searches id ${SNAPSHOT_ID} still exists and VITE_SUPABASE_* are set)`);
    }
    // exitCode, not exit(): lets the large report above flush to a pipe first.
    process.exitCode = 1;
    return;
  }
  console.log('\nOK: todos os modos passaram.');
}

// Exit explicitly once stdout has flushed: a leftover handle (server pipe,
// timer) must never turn a finished run into a CI timeout, and exiting only
// after the flush keeps the full report when piped.
main()
  .catch((err) => {
    console.error('Smoke test crashed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    process.stdout.write('', () => process.exit(process.exitCode ?? 0));
  });
