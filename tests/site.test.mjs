import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve("_site");
const pages = ["index.html", "404.html", "csv-excel-converter/index.html", "excel-deduplicate/index.html", "excel-merge/index.html", "excel-split-by-column/index.html", "excel-compare/index.html", "about/index.html", "privacy/index.html", "terms/index.html", "licenses/index.html"];

test("all generated pages have titles, descriptions, one H1 and valid local assets", () => {
  for (const relative of pages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /<title>[^<]+<\/title>/, relative);
    assert.match(html, /<meta name="description" content="[^"]+">/, relative);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, relative);
    assert.doesNotMatch(html, /<span><h[1-6]>/, relative);
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => JSON.parse(match[1]), relative);
    for (const match of html.matchAll(/(?:href|src)="(\/[^"]+)"/g)) {
      const url = match[1].split("#")[0];
      if (!url || url.startsWith("//")) continue;
      const target = url.endsWith("/") ? path.join(root, url, "index.html") : path.join(root, url);
      assert.ok(existsSync(target), `${relative}: missing ${url}`);
    }
  }
});

test("SEO output excludes obsolete FAQ markup and keeps the 404 out of the index", () => {
  for (const relative of pages.filter((name) => name.includes("excel-") || name.includes("csv-excel"))) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.doesNotMatch(html, /"@type":"FAQPage"/, relative);
    assert.doesNotMatch(html, /<span><h3>/, relative);
    assert.match(html, /og:image/, relative);
    assert.match(html, /id="encoding"/, `${relative}: missing CSV encoding selector`);
    assert.match(html, /"dateModified":"\d{4}-\d{2}-\d{2}"/, `${relative}: missing schema freshness date`);
  }
  const notFound = readFileSync(path.join(root, "404.html"), "utf8");
  assert.match(notFound, /name="robots" content="noindex,follow"/);
  assert.doesNotMatch(notFound, /rel="canonical"/);
});

test("published guidance matches split and compare behavior", () => {
  const converter = readFileSync(path.join(root, "csv-excel-converter/index.html"), "utf8");
  const split = readFileSync(path.join(root, "excel-split-by-column/index.html"), "utf8");
  const compare = readFileSync(path.join(root, "excel-compare/index.html"), "utf8");
  assert.match(converter, /自动按新编码重新读取当前文件/);
  assert.doesNotMatch(converter, /切换编码后要重新选择文件/);
  assert.match(split, /“华东”和“华东 ”会进入同一文件/);
  assert.doesNotMatch(split, /“华东”和“华东 ”是两个不同分组/);
  assert.match(compare, /发现重复值时，工具会停止/);
});

test("all tool runs and merge encoding changes invalidate old results", () => {
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  const runInvalidations = source.match(/\$\("#run"\)\.addEventListener\("click", async \(\) => \{\s+invalidateResult\(\);/g) || [];
  assert.equal(runInvalidations.length, 5);
  assert.match(source, /function initializeMerge\(\)[\s\S]*?bindEncodingReload\(\[\$\("#files"\)\], \{ reload: false \}\)/);
});

test("tool explanations have substantial visible content", () => {
  const toolPages = pages.filter((name) => name.includes("excel-") || name.includes("csv-excel"));
  const sentenceOwners = new Map();
  for (const relative of toolPages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    const visible = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    assert.ok([...visible].length > 1100, `${relative}: content is too thin`);
    for (const sentence of visible.split(/[。！？]/).map((value) => value.trim()).filter((value) => [...value].length >= 12)) {
      if (!sentenceOwners.has(sentence)) sentenceOwners.set(sentence, new Set());
      sentenceOwners.get(sentence).add(relative);
    }
  }
  const repeated = [...sentenceOwners].filter(([, owners]) => owners.size >= 3).map(([sentence]) => sentence);
  assert.deepEqual(repeated, [], `repeated sentences: ${repeated.join(" | ")}`);
});
