// ============================================================
//  tests/reporters/client-report.ts
//  Custom Playwright reporter → produces a polished, PDF-ready,
//  client-facing HTML execution report with Folio3 branding.
//
//  How it works:
//    - Each test attaches a JSON blob named "client-report-data"
//      containing { title, testData, steps, screenshots, meta }.
//    - This reporter collects those attachments across all tests
//      and renders ONE self-contained HTML file (images inlined as
//      base64 so it can be emailed / printed to PDF with no assets).
//
//  Wire it up in playwright.config.ts:
//    reporter: [
//      ['list'],
//      ['html', { open: 'never' }],
//      ['./tests/reporters/client-report.ts', { outputFile: 'reports/Client_Execution_Report.html' }],
//    ]
//
//  Print to PDF: open the HTML in Chrome → Print → Save as PDF
//  (A4, "Background graphics" ON). The CSS is tuned for clean page breaks.
// ============================================================

import type {
  Reporter, FullConfig, Suite, TestCase, TestResult, FullResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface StepRow {
  step:   string;
  detail: string;
  status: 'PASS' | 'FAIL' | 'INFO';
  durationMs?: number;   // per-step timing
}

interface ClientReportData {
  title:    string;
  meta:     Record<string, string>;   // batch order, boxes, weight, etc.
  testData: Record<string, string>;   // item, site, warehouse, ...
  steps:    StepRow[];
  screenshots: { label: string; base64: string }[];
}

interface CollectedTest {
  name:     string;
  status:   string;          // 'passed' | 'failed' | 'timedOut' | ...
  durationMs: number;
  data?:    ClientReportData;
}

class ClientReporter implements Reporter {
  private outputFile: string;
  private collected: CollectedTest[] = [];
  private runStartedAt = new Date();

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = options.outputFile || 'reports/Client_Execution_Report.html';
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.runStartedAt = new Date();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Pull our JSON attachment (if the test produced one)
    let data: ClientReportData | undefined;
    const att = result.attachments.find(a => a.name === 'client-report-data');
    if (att?.body) {
      try { data = JSON.parse(att.body.toString('utf-8')); } catch { /* ignore */ }
    }
    this.collected.push({
      name: test.title,
      status: result.status,
      durationMs: result.duration,
      data,
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    const dir = path.dirname(this.outputFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const html = this.renderHtml(result);
    fs.writeFileSync(this.outputFile, html, 'utf-8');
    // eslint-disable-next-line no-console
    console.log(`\n📄 Client report written: ${path.resolve(this.outputFile)}`);
  }

  // ──────────────────────────────────────────────────────────
  //  HTML rendering
  // ──────────────────────────────────────────────────────────
  private renderHtml(result: FullResult): string {
    const overall = result.status === 'passed' ? 'PASS' : 'FAIL';
    const finishedAt = new Date();
    const totalMs = finishedAt.getTime() - this.runStartedAt.getTime();

    const sections = this.collected.map(t => this.renderTestSection(t)).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Test Execution Report</title>
${STYLES}
</head>
<body>
  <div class="page">
    <!-- ── Cover / header ──────────────────────────────────── -->
    <header class="cover">
      <div class="brandbar"></div>
      <div class="cover-inner">
        <div class="logo">FOLIO3</div>
        <h1>Test Execution Report</h1>
        <p class="subtitle">Automated End-to-End Verification</p>
        <div class="cover-meta">
          <div><span>Overall Result</span><strong class="badge ${overall === 'PASS' ? 'pass' : 'fail'}">${overall}</strong></div>
          <div><span>Executed</span><strong>${esc(this.runStartedAt.toLocaleString())}</strong></div>
          <div><span>Duration</span><strong>${fmtDuration(totalMs)}</strong></div>
          <div><span>Test Cases</span><strong>${this.collected.length}</strong></div>
        </div>
      </div>
    </header>

    ${sections}

    <footer class="report-footer">
      <span>Folio3 — Quality Assurance</span>
      <span>Confidential</span>
      <span>Generated ${esc(finishedAt.toLocaleString())}</span>
    </footer>
  </div>
</body>
</html>`;
  }

  private renderTestSection(t: CollectedTest): string {
    const statusLabel = t.status === 'passed' ? 'PASS' : 'FAIL';
    const d = t.data;

    const metaTable = d?.meta
      ? `<table class="kv"><tbody>${Object.entries(d.meta)
          .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`
      : '';

    const testDataTable = d?.testData
      ? `<h3>Test Data</h3><table class="kv"><tbody>${Object.entries(d.testData)
          .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`
      : '';

    const stepRows = (d?.steps || []).map((s, i) => {
      const cls = s.status === 'PASS' ? 'ok' : s.status === 'FAIL' ? 'bad' : 'info';
      const dur = s.durationMs != null ? fmtDuration(s.durationMs) : '—';
      return `<tr>
        <td class="num">${i + 1}</td>
        <td>${esc(s.step)}</td>
        <td class="detail">${esc(s.detail || '')}</td>
        <td class="dur">${dur}</td>
        <td class="status ${cls}"><span>${esc(s.status)}</span></td>
      </tr>`;
    }).join('');

    const stepsTable = stepRows
      ? `<h3>Execution Steps</h3>
         <table class="steps">
           <thead><tr><th>#</th><th>Step</th><th>Detail</th><th>Time</th><th>Status</th></tr></thead>
           <tbody>${stepRows}</tbody>
         </table>`
      : '<p class="muted">No step details were captured for this test.</p>';

    const shots = (d?.screenshots || []).filter(s => s.base64);
    const shotsBlock = shots.length
      ? `<h3>Evidence</h3>
         <div class="shots">
           ${shots.map(s => `
             <figure>
               <img src="data:image/png;base64,${s.base64}" alt="${esc(s.label)}" />
               <figcaption>${esc(s.label)}</figcaption>
             </figure>`).join('')}
         </div>`
      : '';

    return `<section class="testcase">
      <div class="tc-head">
        <h2>${esc(d?.title || t.name)}</h2>
        <span class="badge ${statusLabel === 'PASS' ? 'pass' : 'fail'}">${statusLabel}</span>
      </div>
      <p class="tc-sub">Run time: ${fmtDuration(t.durationMs)}</p>
      ${metaTable}
      ${testDataTable}
      ${stepsTable}
      ${shotsBlock}
    </section>`;
  }
}

// ── helpers ────────────────────────────────────────────────
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function fmtDuration(ms: number): string {
  if (ms == null || isNaN(ms)) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

// ── styles (refined, print-ready, Folio3 red accent) ───────
const STYLES = `<style>
  :root{
    --red:#C00000; --red-dark:#9a0000; --ink:#1a1a1a; --muted:#6b6b6b;
    --line:#e6e6e6; --bg:#ffffff; --soft:#f7f7f8; --ok:#1a7f37; --bad:#c0152b;
    --serif:Georgia,'Times New Roman',serif;
    --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;background:#ececed;color:var(--ink);font-family:var(--sans);}
  .page{max-width:900px;margin:24px auto;background:var(--bg);box-shadow:0 2px 18px rgba(0,0,0,.08);}
  /* Cover */
  .cover{position:relative;}
  .brandbar{height:8px;background:linear-gradient(90deg,var(--red),var(--red-dark));}
  .cover-inner{padding:48px 56px 36px;border-bottom:1px solid var(--line);}
  .logo{font-weight:800;letter-spacing:.18em;color:var(--red);font-size:15px;margin-bottom:28px;}
  h1{font-family:var(--serif);font-size:34px;margin:0 0 6px;font-weight:700;}
  .subtitle{color:var(--muted);margin:0 0 28px;font-size:15px;}
  .cover-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;}
  .cover-meta>div{display:flex;flex-direction:column;gap:4px;}
  .cover-meta span{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);}
  .cover-meta strong{font-size:15px;}
  /* Badge */
  .badge{display:inline-block;padding:4px 14px;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:.05em;}
  .badge.pass{background:#e7f5ec;color:var(--ok);border:1px solid #b8e0c6;}
  .badge.fail{background:#fdeaec;color:var(--bad);border:1px solid #f3b9c1;}
  /* Test case section */
  .testcase{padding:36px 56px;border-bottom:1px solid var(--line);}
  .tc-head{display:flex;align-items:center;justify-content:space-between;gap:16px;}
  .tc-head h2{font-family:var(--serif);font-size:22px;margin:0;}
  .tc-sub{color:var(--muted);font-size:13px;margin:4px 0 20px;}
  h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--red);
     margin:26px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--red);display:inline-block;}
  /* Key-value tables */
  table.kv{width:100%;border-collapse:collapse;margin-bottom:6px;}
  table.kv th{text-align:left;width:34%;padding:7px 10px;font-weight:600;color:var(--muted);
              background:var(--soft);border:1px solid var(--line);font-size:13px;}
  table.kv td{padding:7px 10px;border:1px solid var(--line);font-size:13px;}
  /* Steps table */
  table.steps{width:100%;border-collapse:collapse;font-size:13px;margin-top:4px;}
  table.steps thead th{background:var(--red);color:#fff;text-align:left;padding:9px 10px;
                       font-size:12px;letter-spacing:.04em;}
  table.steps tbody td{padding:8px 10px;border:1px solid var(--line);vertical-align:top;}
  table.steps tbody tr:nth-child(even){background:var(--soft);}
  td.num{width:34px;color:var(--muted);text-align:center;}
  td.detail{color:var(--muted);}
  td.dur{width:64px;color:var(--muted);white-space:nowrap;}
  td.status{width:78px;text-align:center;}
  td.status span{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:700;font-size:11px;}
  td.status.ok span{background:#e7f5ec;color:var(--ok);}
  td.status.bad span{background:#fdeaec;color:var(--bad);}
  td.status.info span{background:#eef0f2;color:var(--muted);}
  .muted{color:var(--muted);font-size:13px;}
  /* Screenshots */
  .shots{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:8px;}
  .shots figure{margin:0;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:var(--soft);}
  .shots img{width:100%;display:block;}
  .shots figcaption{padding:8px 10px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);}
  /* Footer */
  .report-footer{display:flex;justify-content:space-between;padding:18px 56px;
                 font-size:11px;color:var(--muted);background:var(--soft);}
  /* Print / PDF */
  @page{size:A4;margin:14mm;}
  @media print{
    html,body{background:#fff;}
    .page{box-shadow:none;margin:0;max-width:none;}
    .testcase{page-break-inside:avoid;}
    .shots figure{page-break-inside:avoid;}
    table.steps{page-break-inside:auto;}
    table.steps tr{page-break-inside:avoid;}
  }
</style>`;

export default ClientReporter;