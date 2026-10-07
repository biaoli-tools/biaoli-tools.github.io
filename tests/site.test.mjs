import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve("_site");
const pages = ["index.html", "404.html", "csv-excel-converter/index.html", "csv-encoding-fix/index.html", "excel-deduplicate/index.html", "excel-two-column-compare/index.html", "excel-merge/index.html", "excel-split-by-column/index.html", "excel-compare/index.html", "about/index.html", "privacy/index.html", "terms/index.html", "licenses/index.html"];
const toolPages = pages.filter((name) => name.includes("excel-") || name.startsWith("csv-"));

test("all generated pages have titles, descriptions, one H1 and valid local assets", () => {
  for (const relative of pages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /<title>[^<]+<\/title>/, relative);
    assert.match(html, /<meta name="description" content="[^"]+">/, relative);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, relative);
    assert.equal((html.match(/G-3ERPJ3X77R/g) || []).length, 2, `${relative}: GA4 tag missing or duplicated`);
    assert.match(html, /googletagmanager\.com\/gtag\/js\?id=G-3ERPJ3X77R/, relative);
    assert.doesNotMatch(html, /<span><h[1-6]>/, relative);
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => JSON.parse(match[1]), relative);
    for (const match of html.matchAll(/(?:href|src)="(\/[^"]+)"/g)) {
      const url = match[1].split("#")[0].split("?")[0];
      if (!url || url.startsWith("//")) continue;
      const target = url.endsWith("/") ? path.join(root, url, "index.html") : path.join(root, url);
      assert.ok(existsSync(target), `${relative}: missing ${url}`);
    }
  }
});

test("friend links are limited to the homepage and open safely", () => {
  const expected = [
    ["出海工具箱", "https://chuhai-nav-6xf.pages.dev/"],
    ["VPN 指南", "https://agoodvpn.github.io/vpn-guide/"],
    ["次元口袋", "https://jigen-pocket.proud-2531.chatgpt.site/"],
    ["光影导航", "https://guangying-nav.woshioyea.workers.dev/"]
  ];
  const home = readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(home, /aria-label="友情链接"/);
  for (const [name, url] of expected) {
    assert.match(home, new RegExp(`href="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" target="_blank" rel="noopener noreferrer">${name}<\/a>`));
  }
  for (const relative of pages.filter((name) => name !== "index.html")) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.doesNotMatch(html, /aria-label="友情链接"/, relative);
  }
});

test("privacy policy reflects the active analytics configuration", () => {
  const privacy = readFileSync(path.join(root, "privacy/index.html"), "utf8");
  assert.match(privacy, /使用 Google Analytics 4/);
  assert.match(privacy, /不会主动把文件名、列名、单元格内容或导出结果发送给统计服务/);
  assert.doesNotMatch(privacy, /当前版本没有配置访问统计/);
});

test("sponsor placements balance visibility with tool usability", () => {
  const primaryOnly = [
    "csv-encoding-fix/index.html",
    "excel-two-column-compare/index.html",
    "excel-split-by-column/index.html"
  ];
  const doublePlacement = [
    "excel-deduplicate/index.html",
    "excel-merge/index.html",
    "excel-compare/index.html",
    "csv-excel-converter/index.html"
  ];

  const home = readFileSync(path.join(root, "index.html"), "utf8");
  assert.equal((home.match(/href="https:\/\/huyuejsq\.co\/"/g) || []).length, 2);
  assert.match(home, /data-sponsor-placement="home_primary"/);
  assert.match(home, /data-sponsor-placement="home_secondary"/);
  assert.equal((home.match(/class="promo-banner"/g) || []).length, 1);
  assert.equal((home.match(/class="sponsor-card"/g) || []).length, 1);

  for (const relative of doublePlacement) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.equal((html.match(/href="https:\/\/huyuejsq\.co\/"/g) || []).length, 2, relative);
    assert.match(html, /data-sponsor-placement="tool_primary"/, relative);
    assert.match(html, /data-sponsor-placement="tool_secondary"/, relative);
    assert.equal((html.match(/class="promo-banner"/g) || []).length, 1, `${relative}: only one large banner`);
    assert.equal((html.match(/class="sponsor-card"/g) || []).length, 1, `${relative}: secondary placement stays compact`);
  }

  for (const relative of primaryOnly) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.equal((html.match(/href="https:\/\/huyuejsq\.co\/"/g) || []).length, 1, relative);
    assert.match(html, /data-sponsor-placement="tool_primary"/, relative);
    assert.doesNotMatch(html, /data-sponsor-placement="tool_secondary"/, relative);
  }

  const promotedPages = ["index.html", ...toolPages];
  for (const relative of promotedPages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /rel="sponsored noopener noreferrer"/, relative);
    assert.match(html, /虎跃加速器/, relative);
    assert.match(html, /huyue-logo\.png\?v=/, `${relative}: sponsor logo should be a local versioned asset`);
    assert.doesNotMatch(html, /突破|解锁|保证提速|绝对安全/, relative);
  }
  for (const relative of pages.filter((name) => !promotedPages.includes(name))) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.doesNotMatch(html, /href="https:\/\/huyuejsq\.co\/"/, relative);
  }
  for (const relative of toolPages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /<\/section><section class="promo-band"[\s\S]*?<section class="section white">/, `${relative}: primary promotion should sit between workbench and explanatory content`);
  }
  const privacy = readFileSync(path.join(root, "privacy/index.html"), "utf8");
  const terms = readFileSync(path.join(root, "terms/index.html"), "utf8");
  assert.match(privacy, /部分页面可能展示明确标注的第三方推广链接/);
  assert.match(privacy, /不会读取或接收你在工具中选择的表格文件/);
  assert.match(privacy, /推广位标识、所在页面等基础信息/);
  assert.doesNotMatch(privacy, /虎跃加速器|主横幅|轻量合作位/);
  assert.match(terms, /不对第三方产品的速度、安全性、可用性或适用性作保证/);
});

test("sponsor analytics track views and clicks without table data", () => {
  const app = readFileSync(path.join(root, "assets/app.js"), "utf8");
  assert.match(app, /sponsor_click/);
  assert.match(app, /sponsor_view/);
  assert.match(app, /intersectionRatio < 0\.5/);
  assert.match(app, /sponsor: link\.dataset\.sponsor/);
  assert.match(app, /placement: link\.dataset\.sponsorPlacement/);
  assert.match(app, /page_path: location\.pathname/);
  assert.doesNotMatch(app, /fileName|columnName|cellValue/);
});

test("SEO output excludes obsolete FAQ markup and keeps the 404 out of the index", () => {
  for (const relative of toolPages) {
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

test("published guidance matches split, encoding-fix and compare behavior", () => {
  const converter = readFileSync(path.join(root, "csv-excel-converter/index.html"), "utf8");
  const encodingFix = readFileSync(path.join(root, "csv-encoding-fix/index.html"), "utf8");
  const split = readFileSync(path.join(root, "excel-split-by-column/index.html"), "utf8");
  const compare = readFileSync(path.join(root, "excel-compare/index.html"), "utf8");
  assert.match(converter, /原 CSV 已经显示乱码时，先用 CSV 中文乱码修复/);
  assert.match(encodingFix, /切换候选编码并直接看数据预览/);
  assert.match(split, /“华东”和“华东 ”会进入同一文件/);
  assert.doesNotMatch(split, /“华东”和“华东 ”是两个不同分组/);
  assert.match(compare, /发现重复值时，工具会停止/);
});

test("all tool runs and merge encoding changes invalidate old results", () => {
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  const runInvalidations = source.match(/\$\("#run"\)\.addEventListener\("click", async \(\) => \{\s+if \(!beginRun\(\)\) return;\s+invalidateResult\(\);/g) || [];
  assert.equal(runInvalidations.length, 7);
  assert.match(source, /function initializeMerge\(\)[\s\S]*?bindEncodingReload\(\[\$\("#files"\)\], \{ reload: false \}\)/);
});


test("content dates are explicit and do not silently follow build time", () => {
  const sitemap = readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.match(sitemap, /<loc>https:\/\/biaoli-tools\.github\.io\/terms\/<\/loc><lastmod>2026-10-07<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/biaoli-tools\.github\.io\/excel-compare\/<\/loc><lastmod>2026-10-07<\/lastmod>/);
  const compare = readFileSync(path.join(root, "excel-compare/index.html"), "utf8");
  assert.match(compare, /"dateModified":"2026-10-07"/);
});


test("homepage stays user-facing and does not explain internal URL strategy", () => {
  const home = readFileSync(path.join(root, "index.html"), "utf8");
  assert.doesNotMatch(home, /独立页面和固定 URL|搜索落地页|SEO|页面规划/);
  assert.match(home, /输入你遇到的问题/);
});

test("dedupe page exposes date-based keep rules", () => {
  const page = readFileSync(path.join(root, "excel-deduplicate/index.html"), "utf8");
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(page, /value="latest">按日期保留最新/);
  assert.match(page, /value="earliest">按日期保留最早/);
  assert.match(page, /id="date-column"/);
  assert.match(page, /不需要先手动排序/);
  assert.match(source, /dateIndex/);
});
test("about page contains user-facing product information, not maintenance notes", () => {
  const about = readFileSync(path.join(root, "about/index.html"), "utf8");
  assert.match(about, /表理工具做什么/);
  assert.match(about, /文件在哪里处理/);
  assert.doesNotMatch(about, /构建过程|数据测试覆盖|更新记录|规则与功能最近核对|SEO/);
});

test("compare page and export expose field-level change details", () => {
  const compare = readFileSync(path.join(root, "excel-compare/index.html"), "utf8");
  const tools = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(compare, /字段名、旧值和新值/);
  assert.match(compare, /字段差异/);
  assert.match(tools, /name: "字段差异"/);
  assert.match(tools, /\["关键值", "字段", "旧值", "新值"\]/);
});

test("core search intent and contextual links are explicit", () => {
  const converter = readFileSync(path.join(root, "csv-excel-converter/index.html"), "utf8");
  const split = readFileSync(path.join(root, "excel-split-by-column/index.html"), "utf8");
  const compare = readFileSync(path.join(root, "excel-compare/index.html"), "utf8");
  const dedupe = readFileSync(path.join(root, "excel-deduplicate/index.html"), "utf8");
  const merge = readFileSync(path.join(root, "excel-merge/index.html"), "utf8");
  assert.match(converter, /<h1>CSV 转 Excel \/ Excel 转 CSV<\/h1>/);
  assert.match(converter, /CSV 转 Excel 怎么避免前导 0 和长数字变化/);
  assert.doesNotMatch(converter, /<title>[^<]*乱码/);
  assert.match(converter, /href="\/csv-encoding-fix\/"/);
  assert.match(split, /<h1>Excel 按列值拆分成多个文件<\/h1>/);
  assert.match(split, /不是把一列文字拆成多列/);
  assert.match(compare, /<h1>Excel 表格差异对比<\/h1>/);
  assert.match(compare, /不要按行号比较/);
  assert.match(compare, /href="\/excel-two-column-compare\/"/);
  assert.match(dedupe, /href="\/excel-compare\/"/);
  assert.match(merge, /href="\/excel-compare\/"/);
});

test("tool explanations have substantial visible content", () => {
  const sentenceOwners = new Map();
  for (const relative of toolPages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<section class="workspace"[\s\S]*?<\/section>/g, " ")
      .replace(/<section class="promo-band"[\s\S]*?<\/section>/g, " ")
      .replace(/<footer[\s\S]*?<\/footer>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    assert.ok([...visible].length > 900, `${relative}: explanatory content is too thin`);
    for (const sentence of visible.split(/[。！？]/).map((value) => value.trim()).filter((value) => [...value].length >= 12)) {
      if (!sentenceOwners.has(sentence)) sentenceOwners.set(sentence, new Set());
      sentenceOwners.get(sentence).add(relative);
    }
  }
  const repeated = [...sentenceOwners].filter(([, owners]) => owners.size >= 3).map(([sentence]) => sentence);
  assert.deepEqual(repeated, [], `repeated sentences: ${repeated.join(" | ")}`);
});


test("crawl controls keep utility samples out of search while index pages stay open", () => {
  const robots = readFileSync(path.join(root, "robots.txt"), "utf8");
  assert.match(robots, /Disallow: \/samples\//);
  for (const relative of pages.filter((name) => !["404.html", "licenses/index.html"].includes(name))) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"/, relative);
  }
  const notFound = readFileSync(path.join(root, "404.html"), "utf8");
  const licenses = readFileSync(path.join(root, "licenses/index.html"), "utf8");
  assert.match(notFound, /name="robots" content="noindex,follow"/);
  assert.match(licenses, /name="robots" content="noindex,follow"/);
  assert.doesNotMatch(readFileSync(path.join(root, "sitemap.xml"), "utf8"), /<loc>https:\/\/biaoli-tools\.github\.io\/licenses\/<\/loc>/);
  for (const relative of toolPages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /href="\/samples\/[^\"]+" download rel="nofollow"/, relative);
  }
});

test("tool controls expose safer and more accessible interaction states", () => {
  const toolPages = pages.filter((name) => name.includes("excel-") || name.includes("csv-excel"));
  for (const relative of toolPages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /id="download" class="button primary" type="button" disabled/, relative);
    assert.match(html, /aria-live="polite" aria-atomic="true"/, relative);
    assert.match(html, /aria-describedby="[^\"]+-help"/, relative);
  }
  const toolsSource = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(toolsSource, /\$\("#download"\)\.disabled = true/);
  assert.match(toolsSource, /\$\("#download"\)\.disabled = false/);
  assert.match(toolsSource, /<th scope="col">/);
  const appSource = readFileSync(path.resolve("src/js/app.js"), "utf8");
  assert.match(appSource, /event\.key === "Escape"/);
  assert.match(appSource, /navToggle\?\.focus\(\)/);
});

test("home page task finder is searchable without creating duplicate landing pages", () => {
  const home = readFileSync(path.join(root, "index.html"), "utf8");
  const app = readFileSync(path.resolve("src/js/app.js"), "utf8");
  assert.match(home, /id="tool-search" type="search"/);
  assert.equal((home.match(/data-tool-item/g) || []).length, 7);
  assert.match(home, /乱码/);
  assert.match(home, /保留最新/);
  assert.match(home, /按部门拆分/);
  assert.match(app, /function filterTools\(\)/);
  assert.match(app, /toolSearchClear\?\.addEventListener/);
});

test("CSV encoding repair sample actually exercises a legacy Chinese encoding", () => {
  const sample = readFileSync(path.resolve("src/samples/encoding-fix-sample.csv"));
  assert.match(new TextDecoder("gb18030").decode(sample), /张三,销售,客户回访/);
  assert.match(new TextDecoder("utf-8").decode(sample), /�/);
});

test("CSV encoding repair has a distinct intent and rejects unrelated file formats early", () => {
  const page = readFileSync(path.join(root, "csv-encoding-fix/index.html"), "utf8");
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(page, /<h1>CSV 中文乱码修复<\/h1>/);
  assert.match(page, /GBK \/ GB18030/);
  assert.match(page, /Big5/);
  assert.match(page, /UTF-8 BOM/);
  assert.match(page, /accept="\.csv,\.tsv"/);
  assert.match(source, /function initializeEncodingFix\(\)/);
  assert.match(source, /filePattern: \/\\\.\(csv\|tsv\)\$\/i/);
  assert.match(source, /乱码修复只支持 CSV 和 TSV 文件/);
  assert.doesNotMatch(page, /id="encoding-output"[\s\S]*?<option value="xlsx"/);
});

test("two-column compare has a distinct search intent and tool wiring", () => {
  const page = readFileSync(path.join(root, "excel-two-column-compare/index.html"), "utf8");
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(page, /<h1>Excel 两列对比<\/h1>/);
  assert.match(page, /共有值/);
  assert.match(page, /仅第一列/);
  assert.match(page, /仅第二列/);
  assert.match(page, /id="left-column"/);
  assert.match(page, /id="right-column"/);
  assert.match(source, /function initializeColumnCompare\(\)/);
  assert.match(source, /compareColumns\(/);
});

test("home page explains the local file-processing path precisely", () => {
  const home = readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(home, /文件是怎么处理的/);
  assert.match(home, /浏览器取得你主动选择的文件读取权限/);
  assert.match(home, /不代表页面完全没有网络请求/);
  assert.match(home, /工具代码不会把文件名、列名或单元格内容作为统计字段发送/);
});

test("every core tool has a task-specific direct answer block", () => {
  const checks = new Map([
    ["csv-excel-converter/index.html", "CSV 转 Excel 怎么避免前导 0 和长数字变化？"],
    ["csv-encoding-fix/index.html", "CSV 中文乱码怎么修复？"],
    ["excel-deduplicate/index.html", "Excel 去重时怎么保留最新一条？"],
    ["excel-two-column-compare/index.html", "Excel 两列怎么快速找出相同项和不同项？"],
    ["excel-merge/index.html", "多个 Excel 的列顺序不同还能合并吗？"],
    ["excel-split-by-column/index.html", "这里的“按列拆分”是什么意思？"],
    ["excel-compare/index.html", "两个 Excel 版本怎么对比才不会因为排序变化误报？"]
  ]);
  for (const [relative, answer] of checks) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.equal((html.match(/class="answer-block"/g) || []).length, 1, relative);
    assert.match(html, new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), relative);
  }
});

test("pages provide no-script guidance and navigation can expose current-page state", () => {
  const app = readFileSync(path.resolve("src/js/app.js"), "utf8");
  assert.match(app, /setAttribute\("aria-current", "page"\)/);
  for (const relative of pages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /<noscript><div class="noscript-note"/i, relative);
  }
});


test("tool runs lock duplicate submissions and expose progress accessibly", () => {
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(source, /function beginRun\(\)/);
  assert.match(source, /button\.disabled = true/);
  assert.match(source, /button\.setAttribute\("aria-busy", "true"\)/);
  assert.match(source, /function endRun\(\)/);
  assert.match(source, /button\.disabled = !canRun\(\)/);
  assert.match(source, /setAttribute\("aria-valuenow"/);
  for (const relative of toolPages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /role="progressbar"[^>]+aria-valuenow="0"/, relative);
    assert.match(html, /最多显示前 12 行、前 12 列/, relative);
    assert.match(html, /处理另一份文件/, relative);
  }
});

test("shared navigation and document metadata include current accessibility and privacy defaults", () => {
  for (const relative of pages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /name="referrer" content="strict-origin-when-cross-origin"/, relative);
    assert.match(html, /name="color-scheme" content="light"/, relative);
    assert.match(html, /aria-controls="site-nav-links"/, relative);
    assert.match(html, /id="site-nav-links"/, relative);
  }
});


test("result regions move focus to completed output and respect reduced motion", () => {
  const toolPages = pages.filter((name) => name.includes("excel-") || name.includes("csv-excel"));
  for (const relative of toolPages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /id="result" class="step result" role="region" aria-labelledby="result-title" tabindex="-1"/, relative);
    assert.match(html, /id="preview" class="table-wrap" tabindex="0" aria-label="处理结果预览，可横向滚动"/, relative);
  }
  const toolsSource = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(toolsSource, /result\.focus\(\{ preventScroll: true \}\)/);
  assert.match(toolsSource, /prefers-reduced-motion: reduce/);
  assert.match(toolsSource, /处理完成。请检查预览，确认无误后下载完整结果。/);
});

test("home search supports Escape clearing and wide tables expose keyboard scrolling", () => {
  const appSource = readFileSync(path.resolve("src/js/app.js"), "utf8");
  const styles = readFileSync(path.resolve("src/styles.css"), "utf8");
  const compare = readFileSync(path.join(root, "excel-compare/index.html"), "utf8");
  assert.match(appSource, /event\.key !== "Escape" \|\| !toolSearch\.value/);
  assert.match(styles, /\.table-wrap:focus-visible/);
  assert.match(styles, /overscroll-behavior: contain/);
  assert.match(compare, /aria-label="表格示例，可横向滚动"/);
});

test("merge file controls name the affected file for assistive technology", () => {
  const toolsSource = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(toolsSource, /aria-label="上移 \$\{safeName\}"/);
  assert.match(toolsSource, /aria-label="下移 \$\{safeName\}"/);
  assert.match(toolsSource, /aria-label="移除 \$\{safeName\}"/);
});

test("run buttons stay disabled until each tool has valid input", () => {
  for (const relative of toolPages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /id="run" class="button primary" type="button" aria-describedby="run-help" disabled/, relative);
    assert.match(html, /id="run-help" class="field-help">文件准备完成且当前规则有效后/, relative);
  }
  const toolsSource = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(toolsSource, /function canRun\(\)/);
  assert.match(toolsSource, /tool === "merge"\) return state\.files\.length >= 2/);
  assert.match(toolsSource, /tool === "compare"\) return Boolean\(state\.tables\[0\] && state\.tables\[1\]/);
  assert.match(toolsSource, /tool === "dedupe"\) \{[\s\S]*selectedIndexes\(\$\("#columns"\)\)/);
  assert.match(toolsSource, /function refreshRunReady\(\)/);
});

test("errors are announced assertively while routine status remains polite", () => {
  const toolsSource = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(toolsSource, /node\.setAttribute\("role", type === "error" \? "alert" : "status"\)/);
  assert.match(toolsSource, /node\.setAttribute\("aria-live", type === "error" \? "assertive" : "polite"\)/);
  assert.match(toolsSource, /status\(`已开始下载 \$\{name\}/);
});

test("analytics is deferred until after page load", () => {
  const home = readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(home, /function loadAnalytics\(\)/);
  assert.match(home, /window\.addEventListener\('load'/);
  assert.match(home, /requestIdleCallback\(loadAnalytics, \{ timeout: 2000 \}\)/);
  assert.doesNotMatch(home, /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js/);
});

test("stale async file reads cannot overwrite a newer selection", () => {
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(source, /const readVersions = new WeakMap\(\)/);
  assert.match(source, /function beginRead\(input\)/);
  assert.match(source, /function isCurrentRead\(input, version\)/);
  assert.match(source, /if \(!isCurrentRead\(input, readVersion\)\) return;/);
  assert.ok((source.match(/if \(!isCurrentRead\(input, readVersion\)\) return;/g) || []).length >= 4);
});

test("tool inputs and rule controls are locked during processing and restored afterwards", () => {
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(source, /const lockedControls = new WeakMap\(\)/);
  assert.match(source, /function setControlsLocked\(locked\)/);
  assert.match(source, /\.workbench input, \.workbench select, \.workbench button:not\(#run\):not\(#download\)/);
  assert.match(source, /button\.textContent = "处理中…";\n  setControlsLocked\(true\);/);
  assert.match(source, /state\.running = false;\n  setControlsLocked\(false\);/);
});


test("JSZip is loaded on demand instead of blocking every tool page", () => {
  const toolPages = pages.filter((name) => name.includes("excel-") || name.includes("csv-excel"));
  for (const relative of toolPages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.doesNotMatch(html, /<script[^>]+jszip\.min\.js/, relative);
  }
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(source, /function loadJsZip\(\)/);
  assert.match(source, /script\.src = "\/assets\/vendor\/jszip\.min\.js"/);
  assert.match(source, /const JSZipCtor = await loadJsZip\(\)/);
  assert.match(source, /const zip = new JSZipCtor\(\)/);
});

test("processing another file resets the workbench without a page reload", () => {
  const toolPages = pages.filter((name) => name.includes("excel-") || name.includes("csv-excel"));
  for (const relative of toolPages) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, /<button id="reset-tool" class="button" type="button">处理另一份文件<\/button>/, relative);
    assert.doesNotMatch(html, /href="\/(?:excel-|csv-excel)[^"]+\/">处理另一份文件<\/a>/, relative);
  }
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(source, /function resetWorkbench\(\)/);
  assert.match(source, /beginRead\(input\);\n    input\.value = "";/);
  assert.match(source, /state\.files = \[\];\n  state\.tables = \[\];/);
  assert.match(source, /\$\("#reset-tool"\)\?\.addEventListener\("click", resetWorkbench\)/);
});

test("analytics respects explicit browser privacy signals", () => {
  const home = readFileSync(path.join(root, "index.html"), "utf8");
  const privacy = readFileSync(path.join(root, "privacy/index.html"), "utf8");
  assert.match(home, /navigator\.globalPrivacyControl !== true/);
  assert.match(home, /navigator\.doNotTrack !== '1'/);
  assert.match(home, /if \(!analyticsAllowed\(\) \|\| window\.__biaoliAnalyticsLoaded\) return;/);
  assert.match(privacy, /Global Privacy Control（GPC）/);
  assert.match(privacy, /Do Not Track（DNT）/);
});

test("versioned asset URLs prevent stale browser cache mixing after deploys", () => {
  const version = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")).version;
  const home = readFileSync(path.join(root, "index.html"), "utf8");
  const toolPage = readFileSync(path.join(root, "excel-split-by-column/index.html"), "utf8");
  const builtTools = readFileSync(path.join(root, "assets/tools.js"), "utf8");
  assert.match(home, new RegExp(`href="/assets/styles\\.css\\?v=${version.replaceAll(".", "\\.")}"`));
  assert.match(home, new RegExp(`src="/assets/app\\.js\\?v=${version.replaceAll(".", "\\.")}"`));
  assert.match(toolPage, new RegExp(`src="/assets/tools\\.js\\?v=${version.replaceAll(".", "\\.")}"`));
  assert.match(builtTools, new RegExp(`from "\\./data\\.js\\?v=${version.replaceAll(".", "\\.")}"`));
  assert.match(builtTools, new RegExp(`from "\\./xlsx-lite\\.js\\?v=${version.replaceAll(".", "\\.")}"`));
  assert.match(builtTools, new RegExp(`/assets/vendor/jszip\\.min\\.js\\?v=${version.replaceAll(".", "\\.")}`));
});

test("downloads expose result identity and keep blob URLs alive briefly", () => {
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(source, /function formatBytes\(bytes\)/);
  assert.match(source, /function resultDownloadLabel\(\)/);
  assert.match(source, /下载 \$\{state\.result\.name\}（\$\{formatBytes\(size\)\}）/);
  assert.match(source, /document\.body\.appendChild\(anchor\)/);
  assert.match(source, /anchor\.remove\(\)/);
  assert.match(source, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 10000\)/);
});

test("long-running work warns before accidental page exit and ZIP loading can time out", () => {
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(source, /window\.addEventListener\("beforeunload", \(event\) => \{/);
  assert.match(source, /if \(!state\.running\) return;/);
  assert.match(source, /event\.returnValue = "";/);
  assert.match(source, /setTimeout\(\(\) => finish\(\(\) => \{/);
  assert.match(source, /ZIP 组件加载超时，请刷新页面重试/);
});


test("all XLSX read and write paths load JSZip on demand before use", () => {
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(source, /await loadJsZip\(\);\n  const workbook = await readXlsx\(buffer, file\.name\);/);
  assert.match(source, /async function workbookBlob\(sheets\) \{\n  await loadJsZip\(\);\n  return writeXlsx\(sheets\);/);
  assert.match(source, /const JSZipCtor = await loadJsZip\(\);/);
});

test("XLSX parser guards against excessive ZIP expansion before XML parsing", () => {
  const source = readFileSync(path.resolve("src/js/xlsx-lite.js"), "utf8");
  assert.match(source, /MAX_XLSX_EXPANDED_BYTES = 300 \* 1024 \* 1024/);
  assert.match(source, /const expandedBytes = expandedZipBytes\(zip\);/);
  assert.match(source, /解压后的工作簿内容超过 300 MB/);
});


test("tool pages use task-specific actions and identify the current preview", () => {
  const labels = new Map([
    ["csv-excel-converter/index.html", "转换并预览"],
    ["csv-encoding-fix/index.html", "修复编码并预览"],
    ["excel-deduplicate/index.html", "去重并预览"],
    ["excel-two-column-compare/index.html", "对比两列并预览"],
    ["excel-merge/index.html", "合并并预览"],
    ["excel-split-by-column/index.html", "拆分并预览"],
    ["excel-compare/index.html", "对比版本并预览"]
  ]);
  for (const [relative, label] of labels) {
    const html = readFileSync(path.join(root, relative), "utf8");
    assert.match(html, new RegExp(`>${label}<`), relative);
    assert.match(html, /id="preview-label"/, relative);
  }
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(source, /当前预览：/);
  assert.match(source, /previewLabel = "字段差异"/);
  assert.match(source, /previewLabel = "新增记录"/);
});

test("large-file warnings preserve read context and merge ordering avoids dead controls", () => {
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(source, /const readSummary = `已读取/);
  assert.match(source, /warning \? `\$\{readSummary\} \$\{warning\}` : readSummary/);
  assert.match(source, /还需至少选择 1 个文件才能合并/);
  assert.match(source, /index === 0 \? " disabled aria-disabled=/);
  assert.match(source, /index === state\.files\.length - 1 \? " disabled aria-disabled=/);
});


test("merge list stays synchronized with the native file input", () => {
  const source = readFileSync(path.resolve("src/js/tools.js"), "utf8");
  assert.match(source, /function syncMergeInputFiles\(\)/);
  assert.match(source, /const transfer = new DataTransfer\(\)/);
  assert.match(source, /input\.files = transfer\.files/);
  assert.ok(source.includes('state.files.splice(Number(button.dataset.remove), 1);\n    syncMergeInputFiles();'));
});

test("encoding repair copy explains that CSV structure can be normalized", () => {
  const html = readFileSync(path.join(root, "csv-encoding-fix/index.html"), "utf8");
  assert.match(html, /分隔符、引号和换行写法可能被规范化/);
  assert.match(html, /不是逐字节原样转码器/);
});
