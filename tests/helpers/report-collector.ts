// ============================================================
//  tests/helpers/report-collector.ts
//  Shared helper used by tests to (a) record steps with per-step
//  timing, (b) attach a JSON blob the custom client reporter reads,
//  and (c) optionally write the Excel report.
//
//  This keeps the step list in ONE place so the Excel file and the
//  client-facing HTML report always show identical data.
//
//  Requires:  npm i exceljs
//  The Playwright test info is passed in so we can attach data; when
//  running standalone (ts-node) without a test runner, pass null.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

export type StepStatus = 'PASS' | 'FAIL' | 'INFO';

export interface StepRow {
  step:   string;
  detail: string;
  status: StepStatus;
  durationMs?: number;
}

export interface ScreenshotRef {
  label: string;
  filePath: string;   // on-disk path; inlined as base64 at report time
}

export class ReportCollector {
  private steps: StepRow[] = [];
  private screenshots: ScreenshotRef[] = [];
  private startedAt = new Date();
  private lastTick = Date.now();   // for per-step timing

  constructor(
    private title: string,
    private testData: Record<string, string> = {},
  ) {}

  /** Record a step. Per-step duration is measured from the previous add(). */
  add(step: string, status: StepStatus, detail = ''): void {
    const now = Date.now();
    const durationMs = now - this.lastTick;
    this.lastTick = now;
    this.steps.push({ step, detail, status, durationMs });
    const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '•';
    // eslint-disable-next-line no-console
    console.log(`   [report] ${icon} ${step}${detail ? ' — ' + detail : ''}`);
  }

  /** Register a screenshot file to embed in the client report. */
  addScreenshot(label: string, filePath: string): void {
    this.screenshots.push({ label, filePath });
  }

  /**
   * Finalize: attach JSON to the Playwright test (for the custom HTML
   * reporter) and write the Excel file. Pass `testInfo` from a spec, or
   * null when running standalone.
   */
  async finalize(
    testInfo: { attach: (name: string, opts: { body: Buffer; contentType: string }) => Promise<void> } | null,
    meta: Record<string, string>,
  ): Promise<{ excelPath: string }> {
    // 1. Attach JSON for the custom client HTML reporter
    if (testInfo) {
      const screenshots = this.screenshots
        .filter(s => fs.existsSync(s.filePath))
        .map(s => ({ label: s.label, base64: fs.readFileSync(s.filePath).toString('base64') }));

      const payload = {
        title: this.title,
        meta,
        testData: this.testData,
        steps: this.steps,
        screenshots,
      };
      await testInfo.attach('client-report-data', {
        body: Buffer.from(JSON.stringify(payload), 'utf-8'),
        contentType: 'application/json',
      });
    }

    // 2. Write the Excel report
    const excelPath = await this.writeExcel(meta);
    return { excelPath };
  }

  private async writeExcel(meta: Record<string, string>): Promise<string> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Folio3 QA Automation';
    wb.created = this.startedAt;

    const summary = wb.addWorksheet('Summary');
    summary.columns = [{ width: 26 }, { width: 50 }];
    const title = summary.addRow([this.title + ' — Execution Report']);
    title.font = { bold: true, size: 14 };
    summary.addRow([]);
    for (const [k, v] of Object.entries(meta)) {
      const r = summary.addRow([k, v]);
      r.getCell(1).font = { bold: true };
      if (k.toLowerCase().includes('result')) {
        r.getCell(2).font = { bold: true, color: { argb: v === 'PASS' ? 'FF008000' : 'FFFF0000' } };
      }
    }
    summary.addRow([]);
    const tdH = summary.addRow(['Test Data', '']);
    tdH.getCell(1).font = { bold: true, size: 12 };
    for (const [k, v] of Object.entries(this.testData)) {
      const r = summary.addRow([k, v]);
      r.getCell(1).font = { bold: true };
    }

    const stepsSheet = wb.addWorksheet('Steps');
    stepsSheet.columns = [
      { header: '#',        key: 'idx',    width: 6 },
      { header: 'Step',     key: 'step',   width: 55 },
      { header: 'Detail',   key: 'detail', width: 50 },
      { header: 'Time (s)', key: 'dur',    width: 10 },
      { header: 'Status',   key: 'status', width: 12 },
    ];
    const hdr = stepsSheet.getRow(1);
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } };
    this.steps.forEach((s, i) => {
      const row = stepsSheet.addRow({
        idx: i + 1, step: s.step, detail: s.detail,
        dur: s.durationMs != null ? Math.round(s.durationMs / 1000) : '',
        status: s.status,
      });
      const c = row.getCell('status');
      if (s.status === 'PASS') c.font = { bold: true, color: { argb: 'FF008000' } };
      else if (s.status === 'FAIL') c.font = { bold: true, color: { argb: 'FFFF0000' } };
      else c.font = { color: { argb: 'FF808080' } };
    });
    stepsSheet.views = [{ state: 'frozen', ySplit: 1 }];

    const dir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `${this.title.replace(/\s+/g, '_')}_${stamp}.xlsx`);
    await wb.xlsx.writeFile(file);
    return file;
  }
}