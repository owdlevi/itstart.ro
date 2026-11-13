#!/usr/bin/env node
/**
 * ITStart visual review: capture every screen in one run and compare it with the design PNGs.
 *
 *   npm i -D playwright pngjs pixelmatch && npx playwright install chromium
 *
 *   node tools/capture.mjs reference                  # re-render design/screens/*.png from design/reference/*.html
 *   node tools/capture.mjs app --base http://localhost:3000 [--only 01,04] [--milestone M1] [--theme light] [--device mobile]
 *   node tools/capture.mjs self-test                  # renders the references as if they were the app; every diff should be ~0%
 *
 * "app" mode needs the app running in design-fixtures mode (see HANDOVER.md, section 9):
 *   - fixtures from design/fixtures.json loaded, server clock frozen at screens.json "capturedAt"
 *   - GET /dev/login-as/<handle>?next=<path>   signs in as that fixture user ("anonymous" signs out)
 *   - theme taken from localStorage "theme" ("light" | "dark") and applied as <html data-theme>
 *
 * Output (review/ is safe to delete):
 *   review/app/<name>.png    what the app rendered
 *   review/diff/<name>.png   red = pixels that differ; magenta = area outside one of the two images
 *   review/side/<name>.png   reference | app | diff, side by side, for a person or an agent to read
 *   review/report.json       per variant: size of each image, differing pixels in %, status
 */
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESIGN = path.join(ROOT, "design");
const REVIEW = path.join(ROOT, "review");
const spec = JSON.parse(fs.readFileSync(path.join(DESIGN, "screens.json"), "utf8"));

const args = process.argv.slice(2);
const mode = args[0];
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : dflt;
};
const PASS = Number(opt("pass", "1.5")); // % of differing pixels still counted as a match
const WARN = Number(opt("warn", "5"));

function variants() {
  const only = opt("only")?.split(",");
  const milestone = opt("milestone");
  const theme = opt("theme");
  const device = opt("device");
  return spec.screens
    .filter((s) => (!only || only.includes(s.id)) && (!milestone || s.milestone <= milestone))
    .flatMap((s) => s.variants.map((v) => ({ ...v, screen: s })))
    .filter((v) => (!theme || v.theme === theme) && (!device || v.device === device));
}

async function shoot(browser, v, url, { app }) {
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: 900 },
    deviceScaleFactor: v.deviceScaleFactor,
    colorScheme: v.theme,
    locale: "ro-RO",
    timezoneId: "Europe/Bucharest",
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(spec.capturedAt));
  if (app) {
    await ctx.addInitScript((theme) => {
      try { localStorage.setItem("theme", theme); } catch {}
      document.documentElement.dataset.theme = theme;
    }, v.theme);
    const who = v.screen.viewer ?? "anonymous";
    await page.goto(`${url.origin}/dev/login-as/${who}?next=${encodeURIComponent(url.pathname)}`, { waitUntil: "networkidle" });
    if (new URL(page.url()).pathname !== url.pathname) await page.goto(url.href, { waitUntil: "networkidle" });
  } else {
    await page.goto(url.href, { waitUntil: "networkidle" });
  }
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  const buf = await page.screenshot({ fullPage: true });
  await ctx.close();
  return buf;
}

function pad(png, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let i = 0; i < out.data.length; i += 4) out.data.set([255, 0, 255, 255], i);
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

function compare(refBuf, appBuf) {
  const a = PNG.sync.read(refBuf);
  const b = PNG.sync.read(appBuf);
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  const A = pad(a, w, h);
  const B = pad(b, w, h);
  const D = new PNG({ width: w, height: h });
  const n = pixelmatch(A.data, B.data, D.data, w, h, { threshold: 0.1, includeAA: false, alpha: 0.25 });
  const gap = 16;
  const S = new PNG({ width: w * 3 + gap * 2, height: h });
  for (let i = 0; i < S.data.length; i += 4) S.data.set([136, 136, 136, 255], i);
  PNG.bitblt(A, S, 0, 0, w, h, 0, 0);
  PNG.bitblt(B, S, 0, 0, w, h, w + gap, 0);
  PNG.bitblt(D, S, 0, 0, w, h, 2 * (w + gap), 0);
  return { diff: D, side: S, percent: (100 * n) / (w * h), ref: [a.width, a.height], app: [b.width, b.height] };
}

async function main() {
  if (!["reference", "app", "self-test"].includes(mode)) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
    process.exit(1);
  }
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const list = variants();

  if (mode === "reference") {
    for (const v of list) {
      const buf = await shoot(browser, v, pathToFileURL(path.join(DESIGN, v.reference)), { app: false });
      fs.writeFileSync(path.join(DESIGN, v.png), buf);
      console.log("wrote", v.png);
    }
    await browser.close();
    return;
  }

  const base = opt("base");
  if (mode === "app" && !base) throw new Error("--base http://localhost:3000 is required");
  for (const d of ["app", "diff", "side"]) fs.mkdirSync(path.join(REVIEW, d), { recursive: true });
  const report = [];
  for (const v of list) {
    const name = path.basename(v.png);
    const url = mode === "app" ? new URL(v.screen.route, base) : pathToFileURL(path.join(DESIGN, v.reference));
    let row = { screen: `${v.screen.id} ${v.screen.title}`, device: v.device, theme: v.theme, url: url.href };
    try {
      const appBuf = await shoot(browser, v, url, { app: mode === "app" });
      fs.writeFileSync(path.join(REVIEW, "app", name), appBuf);
      const r = compare(fs.readFileSync(path.join(DESIGN, v.png)), appBuf);
      fs.writeFileSync(path.join(REVIEW, "diff", name), PNG.sync.write(r.diff));
      fs.writeFileSync(path.join(REVIEW, "side", name), PNG.sync.write(r.side));
      const status = r.percent <= PASS && r.ref[1] === r.app[1] ? "match" : r.percent <= WARN ? "check" : "differs";
      row = { ...row, refSize: r.ref, appSize: r.app, diffPercent: +r.percent.toFixed(2), status };
    } catch (e) {
      row = { ...row, status: "error", error: String(e.message || e) };
    }
    report.push(row);
    console.log(`${row.status.padEnd(8)} ${String(row.diffPercent ?? "-").padStart(6)}%  ${name}${row.appSize && row.refSize[1] !== row.appSize[1] ? `  height ${row.appSize[1]} vs ${row.refSize[1]}` : ""}`);
  }
  fs.writeFileSync(path.join(REVIEW, "report.json"), JSON.stringify(report, null, 1));
  const bad = report.filter((r) => r.status !== "match").length;
  console.log(`\n${report.length - bad}/${report.length} match. Side-by-side images: review/side/`);
  await browser.close();
  process.exitCode = bad ? 1 : 0;
}

main();
