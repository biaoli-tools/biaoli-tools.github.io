import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "_site");
const site = "https://biaoli-tools.github.io";
const analyticsId = "G-3ERPJ3X77R";
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const assetVersion = pkg.version;
const assetUrl = (url) => `${url}?v=${encodeURIComponent(assetVersion)}`;
const tools = [
  { slug: "csv-excel-converter", id: "converter", name: "CSV 转 Excel / Excel 转 CSV", navName: "CSV / Excel 转换", short: "CSV、TSV 与 XLSX 互转", title: "CSV 转 Excel / Excel 转 CSV - 保留前导 0 和长数字 | 表理工具", description: "CSV 转 Excel、Excel 转 CSV 或 TSV，在浏览器本地转换，并尽量保留编号前导 0、手机号、订单号和长数字文本。", modified: "2026-10-07", sample: "/samples/converter-sample.csv", keywords: "csv excel xlsx tsv 转换 转excel 转csv 前导0 长数字 订单号 手机号" },
  { slug: "csv-encoding-fix", id: "encodingFix", name: "CSV 中文乱码修复", navName: "CSV 乱码修复", short: "把 GBK、Big5 等 CSV 重新保存为 UTF-8", title: "CSV 中文乱码修复 - GBK / Big5 转 UTF-8 | 表理工具", description: "修复 CSV 或 TSV 中文乱码：按 UTF-8、GBK / GB18030 或 Big5 重新解码预览，并导出 UTF-8 CSV / TSV，文件只在浏览器本地处理。", modified: "2026-10-07", sample: "/samples/encoding-fix-sample.csv", keywords: "csv 乱码 中文乱码 修复 编码 gbk gb18030 big5 utf8 utf-8 转码 excel 打开乱码" },
  { slug: "excel-deduplicate", id: "dedupe", name: "Excel / CSV 去重", navName: "Excel / CSV 去重", short: "按一列或多列查找重复项", title: "Excel 去重 - 保留最新/最早记录并导出重复项 | 表理工具", description: "Excel、CSV 去重工具，可按单列、多列或整行判断重复，保留首条、末条，或按日期列保留最新/最早记录，并导出重复行审计表。", modified: "2026-10-07", sample: "/samples/deduplicate-sample.csv", keywords: "excel csv 去重 重复 删除重复 重复项 保留最新 保留最早 日期 多列 名单" },
  { slug: "excel-two-column-compare", id: "columnCompare", name: "Excel 两列对比", navName: "Excel 两列对比", short: "找出两列共有、仅左列和仅右列的值", title: "Excel 两列对比 - 找出相同项和不同项 | 表理工具", description: "对比同一份 Excel、CSV 或 TSV 中的两列，找出共有值、仅第一列存在和仅第二列存在的内容，并导出结果。", modified: "2026-10-07", sample: "/samples/two-column-compare-sample.csv", keywords: "excel 两列对比 两列比较 找不同 查重复 相同项 不同项 A列 B列" },
  { slug: "excel-merge", id: "merge", name: "Excel 多文件合并", navName: "Excel 多文件合并", short: "按行或工作表合并多个文件", title: "Excel 合并 - 多个 Excel / CSV 文件批量合并 | 表理工具", description: "批量合并多个 Excel 与 CSV 文件，可按行自动对齐同名表头，或把每个文件保留为独立工作表。", modified: "2026-10-07", sample: "/samples/merge-a.csv", keywords: "excel csv 合并 汇总 多文件 月报 表头 对齐 多sheet 工作表" },
  { slug: "excel-split-by-column", id: "split", name: "Excel 按列值拆分成多个文件", navName: "Excel 按列拆分", short: "按部门、门店或分类批量导出", title: "Excel 按列拆分成多个文件 - 按部门/门店批量导出 | 表理工具", description: "按部门、门店、负责人等指定列的值，把一张 Excel 或 CSV 总表拆成多个 XLSX 文件，并打包为 ZIP 下载。", modified: "2026-10-07", sample: "/samples/split-sample.csv", keywords: "excel csv 拆分 分组 按列 部门 门店 负责人 多文件 zip" },
  { slug: "excel-compare", id: "compare", name: "Excel 表格差异对比", navName: "Excel 差异对比", short: "按关键列找出新增、删除、修改和字段旧值/新值", title: "Excel 表格差异对比 - 按 ID 找出新增、删除和字段修改 | 表理工具", description: "对比两个 Excel、CSV 或 TSV 版本，按订单号、员工编号等唯一字段匹配记录，找出新增、删除和修改，并列出字段旧值与新值。", modified: "2026-10-07", sample: "/samples/compare-old.csv", keywords: "excel csv 对比 比较 差异 两个表 新旧版本 新增 删除 修改 id" }
];

const pageModified = {
  "/": "2026-10-07",
  "/about/": "2026-10-06",
  "/privacy/": "2026-10-07",
  "/terms/": "2026-10-07",
  "/licenses/": "2026-09-09",
  ...Object.fromEntries(tools.map((tool) => [`/${tool.slug}/`, tool.modified]))
};

function formatChineseDate(date) {
  const [year, month, day] = date.split("-");
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
}

function schema(data) {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}

function analyticsTag() {
  return `<!-- Google Analytics loads after the main page load to reduce competition with core UI resources. -->
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    function analyticsAllowed(){
      return navigator.globalPrivacyControl !== true && navigator.doNotTrack !== '1' && window.doNotTrack !== '1';
    }
    function loadAnalytics(){
      if (!analyticsAllowed() || window.__biaoliAnalyticsLoaded) return;
      window.__biaoliAnalyticsLoaded = true;
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=${analyticsId}';
      document.head.appendChild(script);
      gtag('js', new Date());
      gtag('config', '${analyticsId}');
    }
    window.addEventListener('load', () => {
      if ('requestIdleCallback' in window) requestIdleCallback(loadAnalytics, { timeout: 2000 });
      else setTimeout(loadAnalytics, 1000);
    }, { once: true });
  </script>`;
}

const friendLinks = [
  { name: "出海工具箱", url: "https://chuhai-nav-6xf.pages.dev/" },
  { name: "VPN 指南", url: "https://agoodvpn.github.io/vpn-guide/" },
  { name: "次元口袋", url: "https://jigen-pocket.proud-2531.chatgpt.site/" },
  { name: "光影导航", url: "https://guangying-nav.woshioyea.workers.dev/" }
];

function friendLinksHtml() {
  return friendLinks.map(({ name, url }) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>`).join("");
}

function layout({ title, description, pathName = "/", body = "", toolId = "", schemaData = null, indexable = true, canonicalize = true, showFriendLinks = false }) {
  const canonical = `${site}${pathName}`;
  return `<!doctype html>
<!-- biaoli-build: ${assetVersion} -->
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="color-scheme" content="light">
  ${analyticsTag()}
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="${indexable ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" : "noindex,follow"}">
  ${canonicalize ? `<link rel="canonical" href="${canonical}">` : ""}
  <meta property="og:type" content="website">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:site_name" content="表理工具">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${site}/assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="表理工具：Excel 与 CSV 本地整理工具">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#16724a">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${assetUrl("/assets/styles.css")}">
  ${schemaData ? `<script type="application/ld+json">${schema(schemaData)}</script>` : ""}
</head>
<body${toolId ? ` data-tool="${toolId}"` : ""}>
  <a class="skip-link" href="#main">跳到主要内容</a>
  <header class="site-header">
    <nav class="nav" aria-label="主导航">
      <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">${"<i></i>".repeat(9)}</span>表理工具</a>
      <button class="nav-toggle" type="button" aria-label="打开导航" aria-expanded="false" aria-controls="site-nav-links">☰</button>
      <div class="nav-links" id="site-nav-links">
        <a href="/#tools">全部工具</a>
        <a href="/about/">关于与反馈</a>
        <a href="/privacy/">隐私政策</a>
        <a href="/terms/">使用条款</a>
      </div>
    </nav>
  </header>
  <noscript><div class="noscript-note" role="status">工具处理需要启用 JavaScript；页面说明和隐私信息仍可正常阅读。</div></noscript>
  <main id="main" tabindex="-1">${body}</main>
  <footer class="site-footer">
    <div class="shell footer-grid">
      <div class="footer-meta">
        <p>© <span data-year></span> 表理工具 · 文件默认只在当前浏览器中处理</p>
        <div class="footer-links"><a href="/about/">关于与反馈</a><a href="/privacy/">隐私政策</a><a href="/terms/">使用条款</a><a href="/licenses/">第三方许可</a></div>
      </div>
      ${showFriendLinks ? `<nav class="friend-links" aria-label="友情链接">
        <span class="friend-links-label">友情链接</span>
        <div class="friend-links-list">${friendLinksHtml()}</div>
      </nav>` : ""}
    </div>
  </footer>
  <script type="module" src="${assetUrl("/assets/app.js")}"></script>
  ${toolId ? `<script type="module" src="${assetUrl("/assets/tools.js")}"></script>` : ""}
</body>
</html>`;
}

function sheetVisual() {
  const cells = ["", "A", "B", "C", "D", "1", "编号", "部门", "金额", "状态", "2", "A001", "华东", "1280", "已完成", "3", "A002", "华南", "860", "待核对", "4", "A003", "华北", "1560", "已完成"];
  return `<div class="sheet-visual" aria-label="整理后的表格示意"><div class="sheet-bar"><i></i><i></i><i></i></div><div class="sheet-grid">${cells.map((value, index) => `<span class="${index < 5 ? "head" : ""} ${index === 12 ? "active" : ""}">${value}</span>`).join("")}</div></div>`;
}

function promoBanner(placement = "tool_primary") {
  return `<section class="promo-band" aria-label="商业合作推广"><div class="shell"><a class="promo-banner" href="https://huyuejsq.co/" target="_blank" rel="sponsored noopener noreferrer" data-sponsor="huyue" data-sponsor-placement="${placement}" aria-label="广告：虎跃加速器，访问官网查看套餐与客户端下载"><span class="promo-brand"><span class="promo-logo-wrap"><img class="promo-logo" src="${assetUrl("/assets/huyue-logo.png")}" alt="" width="88" height="88" decoding="async"></span><span class="promo-brand-text"><span class="promo-label">广告 · 商业合作</span><strong>虎跃加速器</strong><small>HuYue VPN</small></span></span><span class="promo-copy"><span class="promo-kicker">影音 · 游戏 · 直播</span><strong>多平台网络连接服务</strong><span>查看当前套餐、线路说明与客户端下载信息。</span><span class="promo-pills" aria-hidden="true"><i>多平台客户端</i><i>套餐信息</i><i>线路说明</i></span></span><span class="promo-action"><small>推广链接</small><b>查看套餐详情 <span aria-hidden="true">↗</span></b></span></a></div></section>`;
}

function sponsorCard(placement) {
  return `<aside class="sponsor-card-wrap" aria-label="赞助合作"><a class="sponsor-card" href="https://huyuejsq.co/" target="_blank" rel="sponsored noopener noreferrer" data-sponsor="huyue" data-sponsor-placement="${placement}" aria-label="广告：虎跃加速器，查看套餐与客户端下载"><span class="sponsor-card-brand"><img src="${assetUrl("/assets/huyue-logo.png")}" alt="" width="46" height="46" loading="lazy" decoding="async"><span><small>广告 · 合作伙伴</small><strong>虎跃加速器</strong></span></span><span class="sponsor-card-copy">多平台客户端、套餐与线路信息</span><b>查看详情 <span aria-hidden="true">→</span></b></a></aside>`;
}

const secondarySponsorTools = new Set(["converter", "dedupe", "merge", "compare"]);

function homePage() {
  const body = `<section class="home-intro"><div class="shell"><div><p class="eyebrow">Excel 与 CSV 本地整理工具</p><h1>表理工具<br><span>把杂乱表格理清楚</span></h1><p class="lead">无需登录，不上传文件。CSV 转 Excel、乱码修复、去重、合并、拆分和版本对比都在当前浏览器中完成。</p><div class="actions"><a class="button primary" href="#tools">选择工具 ↓</a><a class="button" href="/privacy/">了解本地处理</a></div></div>${sheetVisual()}</div></section>
  <section class="section" id="tools"><div class="shell"><div class="section-head"><h2>选择要完成的表格任务</h2><p>每个工具只解决一个明确问题。先检查规则与预览，再下载处理结果。</p></div><div class="tool-finder"><label for="tool-search">快速找工具</label><div class="tool-search-row"><input id="tool-search" type="search" inputmode="search" autocomplete="off" placeholder="例如：乱码、去重、合并、按部门拆分、两个表对比" aria-describedby="tool-search-help"><button id="tool-search-clear" class="button" type="button" hidden>清除</button></div><p id="tool-search-help" class="field-help">输入你遇到的问题，例如“乱码”“去重”“部门拆分”或“两个表对比”。</p><p id="tool-search-status" class="sr-only" role="status" aria-live="polite"></p></div><div class="tool-list" data-tool-list>${tools.map((tool, index) => `<a class="tool-link" href="/${tool.slug}/" data-tool-item data-search="${tool.name} ${tool.navName} ${tool.short} ${tool.keywords}"><span class="tool-number">0${index + 1}</span><div><h3>${tool.navName}</h3><p>${tool.short}</p></div><span class="arrow" aria-hidden="true">→</span></a>`).join("")}<div class="tool-empty" data-tool-empty hidden><strong>没有找到完全匹配的工具</strong><p>可以换成更短的词，例如“重复”“乱码”“部门”“对比”。</p></div></div></div></section>${promoBanner("home_primary")}
  <section class="section white"><div class="shell content"><div class="section-head"><h2>按你遇到的问题找工具</h2><p>不知道该选哪个工具时，直接按手头的问题判断。</p></div><div class="facts task-finder"><div class="fact"><strong>CSV 打开后中文全是乱码</strong><span>用 <a href="/csv-encoding-fix/">CSV 中文乱码修复</a>，尝试正确的源编码并重新保存为 UTF-8。</span></div><div class="fact"><strong>CSV 要转 Excel，编号前导 0 又不能丢</strong><span>用 <a href="/csv-excel-converter/">CSV 转 Excel / Excel 转 CSV</a>，重点检查编号、手机号、订单号和日期列。</span></div><div class="fact"><strong>名单有重复，但只想保留最新记录</strong><span>用 <a href="/excel-deduplicate/">Excel / CSV 去重</a>，选择“按日期保留最新”，再指定更新时间列。</span></div><div class="fact"><strong>两列名单想快速找出相同项和缺失项</strong><span>用 <a href="/excel-two-column-compare/">Excel 两列对比</a>，不按行号硬比，直接查看共有值和仅一侧存在的值。</span></div><div class="fact"><strong>多份月报要汇总成一张表</strong><span>用 <a href="/excel-merge/">Excel 多文件合并</a>，同名表头会按名称对齐。</span></div><div class="fact"><strong>总表要分别发给不同部门或门店</strong><span>用 <a href="/excel-split-by-column/">Excel 按列值拆分</a>，按部门、门店或负责人批量生成文件。</span></div><div class="fact"><strong>想知道新版比旧版改了什么</strong><span>用 <a href="/excel-compare/">Excel 表格差异对比</a>，按唯一 ID 匹配，避免排序变化造成误报。</span></div></div></div></section>
  <section class="section"><div class="shell"><div class="section-head"><h2>文件是怎么处理的</h2><p>“本地处理”说的是表格内容的处理路径，不代表页面完全没有网络请求。</p></div><ol class="process-flow"><li><span>1</span><div><strong>你选择文件</strong><p>浏览器取得你主动选择的文件读取权限。</p></div></li><li><span>2</span><div><strong>当前页面解析和整理</strong><p>表格内容在浏览器内存中处理，不发送到本站文件服务器。</p></div></li><li><span>3</span><div><strong>浏览器生成结果</strong><p>结果由当前页面生成，再由浏览器保存到你的设备。</p></div></li></ol><p class="process-note">本站另有页面访问统计；统计用途和边界见 <a href="/privacy/">隐私政策</a>，工具代码不会把文件名、列名或单元格内容作为统计字段发送。</p>${sponsorCard("home_secondary")}</div></section>
  <section class="section white"><div class="shell"><div class="section-head"><h2>处理边界说清楚</h2><p>本地处理不等于没有限制。复杂工作簿仍建议保留原文件并核对结果。</p></div><div class="facts"><div class="fact"><strong>默认不上传文件内容</strong><span>表格解析与导出在当前浏览器完成。</span></div><div class="fact"><strong>单个文件上限 50 MB</strong><span>20 MB 以上会提醒；实际速度还取决于设备内存和文件结构。</span></div><div class="fact"><strong>不承诺完整保真</strong><span>宏、图表、数据透视表和复杂样式不会完整保留。</span></div></div></div></section>`;
  return layout({ title: "表理工具 - Excel 与 CSV 本地整理工具", description: "免费的中文 Excel 与 CSV 本地处理工具，支持 CSV 转 Excel、CSV 乱码修复、去重、两列对比、合并、按列值拆分和差异对比，无需上传文件。", body, schemaData: { "@context": "https://schema.org", "@type": "WebSite", name: "表理工具", alternateName: "表理", url: site, description: "Excel 与 CSV 本地整理工具" }, showFriendLinks: true });
}

function commonUpload({ multiple = false, id = "files", label = "选择文件", accept = ".xlsx,.csv,.tsv", help = "点击选择或直接拖入；支持 XLSX、CSV、TSV；单个文件不超过 50 MB" } = {}) {
  return `<label class="dropzone" for="${id}"><span><strong>${label}</strong><small id="${id}-help">${help}</small></span><input id="${id}" type="file" accept="${accept}" aria-describedby="${id}-help"${multiple ? " multiple" : ""}></label>`;
}

function encodingControl() {
  return `<div class="field"><label for="encoding">CSV / TSV 文字编码</label><select id="encoding"><option value="utf-8">UTF-8</option><option value="gb18030">GBK / GB18030</option><option value="big5">Big5</option></select></div>`;
}

const controls = {
  converter: `${commonUpload()}<div class="field-grid control-spacing">${encodingControl()}<div class="field"><label for="output-format">输出格式</label><select id="output-format"><option value="auto">自动选择相反格式</option><option value="xlsx">Excel（XLSX）</option><option value="csv">CSV（UTF-8）</option><option value="tsv">TSV（UTF-8）</option></select></div><div class="field full"><div class="checks"><label><input id="protect-formulas" type="checkbox" checked>CSV 安全导出：公式型内容按文本保存</label></div></div></div>`,
  encodingFix: `${commonUpload({ accept: ".csv,.tsv", help: "点击选择或直接拖入；仅支持 CSV、TSV；单个文件不超过 50 MB" })}<div class="field-grid control-spacing">${encodingControl()}<div class="field"><label for="encoding-output">输出格式</label><select id="encoding-output"><option value="same">保持原扩展名（CSV / TSV）</option><option value="csv">CSV（UTF-8）</option><option value="tsv">TSV（UTF-8）</option></select></div><div class="field full"><label>导出规则</label><div class="checks"><label><input id="utf8-bom" type="checkbox" checked>添加 UTF-8 BOM，兼容部分 Windows Excel</label><label><input id="protect-formulas" type="checkbox" checked>公式型内容按文本保存</label></div></div></div>`,
  dedupe: `${commonUpload()}<div class="field-grid control-spacing"><fieldset class="field full"><legend>去重依据（可选择多列）</legend><div id="columns" class="column-options"><span class="field-placeholder">读取文件后显示列</span></div></fieldset>${encodingControl()}<div class="field"><label for="keep">重复时保留</label><select id="keep"><option value="first">第一条</option><option value="last">最后一条</option><option value="latest">按日期保留最新</option><option value="earliest">按日期保留最早</option></select></div><div class="field" id="date-column-field" hidden><label for="date-column">日期列</label><select id="date-column" disabled><option>读取文件后显示列</option></select><p class="field-help">支持 YYYY-MM-DD、YYYY/MM/DD，可带 HH:mm:ss。</p></div><div class="field full"><label>文字比较</label><div class="checks"><label><input id="trim" type="checkbox" checked>忽略首尾空格</label><label><input id="ignore-case" type="checkbox">忽略大小写</label></div></div></div>`,
  columnCompare: `${commonUpload()}<div class="field-grid control-spacing">${encodingControl()}<div class="field"><label for="left-column">第一列</label><select id="left-column"><option>读取文件后显示列</option></select></div><div class="field"><label for="right-column">第二列</label><select id="right-column"><option>读取文件后显示列</option></select></div><div class="field full"><label>比较规则</label><div class="checks"><label><input id="trim" type="checkbox" checked>忽略首尾空格</label><label><input id="ignore-case" type="checkbox">忽略大小写</label><label><input id="ignore-empty" type="checkbox" checked>忽略空值</label></div></div></div>`,
  merge: `${commonUpload({ multiple: true, label: "选择至少两个文件" })}<div id="file-list" class="file-list" aria-live="polite"></div><div class="field-grid control-spacing">${encodingControl()}<div class="field"><label for="merge-mode">合并方式</label><select id="merge-mode"><option value="rows">按行合并，同名表头自动对齐</option><option value="sheets">每个文件保留为独立工作表</option></select></div></div>`,
  split: `${commonUpload()}<div class="field-grid control-spacing">${encodingControl()}<div class="field"><label for="group-column">分组列</label><select id="group-column"><option>读取文件后显示列</option></select></div></div>`,
  compare: `<div class="field-grid"><div class="field">${commonUpload({ id: "left-file", label: "选择旧版文件" })}</div><div class="field">${commonUpload({ id: "right-file", label: "选择新版文件" })}</div>${encodingControl()}<div class="field"><label for="key-column">关键列</label><select id="key-column"><option>读取两个文件后显示共有列</option></select></div><div class="field full"><label>匹配规则</label><div class="checks"><label><input id="trim" type="checkbox" checked>忽略首尾空格</label><label><input id="ignore-case" type="checkbox">忽略大小写</label></div></div></div>`
};

const content = {
  converter: {
    notesTitle: "转换前先确认这三点",
    faqTitle: "格式转换常见问题",
    relatedTitle: "转换后继续整理",
    privacy: "转换在当前浏览器内完成，文件内容不会发送到本站服务器。",
    guideTitle: "先确认转换后哪些列不能被自动当成数字",
    guide: "CSV 和 XLSX 的结构并不一样。CSV 是纯文本，XLSX 是工作簿；转换时最容易出问题的是编号、手机号、订单号、日期和公式列。这个转换器适合整理系统导出的名单、订单和报表，不适合拿来复制带图表、宏或复杂样式的工作簿。",
    example: { title: "前导 0 会怎样处理", caption: "示例：CSV 转 XLSX 后，编号继续按文本保存。", headers: ["编号", "姓名", "导出结果"], rows: [["001", "林青", "001"], ["00027", "周宁", "00027"]] },
    rulesTitle: "转换时采用这些规则",
    rules: ["CSV 和 TSV 的第一行作为表头；空表头会补成“第 1 列”这类名称。", "从 XLSX 读取日期时会转换成 YYYY-MM-DD；带时间的数据输出到秒。", "公式保留为以等号开头的公式文本，不在浏览器里重新计算。", "导出 CSV 时默认保护以 =、+、-、@ 开头的内容，避免打开文件时被当作公式执行。"],
    outputTitle: "下载前重点看三类列",
    output: "先抽查订单号、手机号等长数字，再看日期，最后核对原文件中的公式列。CSV 不包含多个工作表，XLSX 转 CSV 时只会使用第一个工作表。",
    stepsTitle: "实际转换只需三步",
    steps: ["选择 CSV、TSV 或 XLSX。旧版 XLS 需要先在表格软件中另存为 XLSX。", "确认输出格式，并抽查编号、手机号、订单号和日期列；如果原 CSV 已经乱码，先使用 CSV 中文乱码修复确认源编码。", "确认有限预览和输出格式，再生成并下载结果。"],
    notes: ["20 MB 以上会出现性能提醒，单个文件上限为 50 MB。", "CSV 输出统一使用带 BOM 的 UTF-8，方便常见表格软件识别中文。", "复杂数字格式不会原样复制，请对照原文件抽查。"],
    limits: "转换解决的是数据交换，不是工作簿克隆。合并单元格、颜色、图表、数据透视表、宏和外部链接不会保留。",
    faq: [["CSV 转 Excel 后，手机号前面的 0 会丢失吗？", "不会主动去掉。CSV 字段会作为文本写入 XLSX，像 013800000001 这样的内容仍按原文字保存。"], ["为什么日期和原文件显示得不完全一样？", "工具会把识别出的日期统一整理成容易核对的格式，不复制自定义年月日格式、颜色或货币样式。"]],
    related: [["/csv-encoding-fix/", "原 CSV 已经显示乱码时，先用 CSV 中文乱码修复确认源编码。"], ["/excel-deduplicate/", "转换后发现名单有重复，可继续用 Excel / CSV 去重。"], ["/excel-merge/", "有多份转换后的月报需要汇总，可用 Excel 多文件合并。"]]
  },
  encodingFix: {
    notesTitle: "乱码修复先看预览，不要盲猜编码",
    faqTitle: "CSV 编码常见问题",
    relatedTitle: "修复后继续处理",
    privacy: "解码、预览和重新导出都在当前浏览器完成，原文件内容不会上传。",
    guideTitle: "乱码通常不是内容坏了，而是用错了文字编码",
    guide: "CSV 是纯文本，没有像 XLSX 那样统一的工作簿编码。旧系统常见 GBK / GB18030，繁体环境也可能使用 Big5；如果应用按错误编码读取，同一批字节就会显示成乱码。这里不会假装能百分之百自动猜中编码，而是让你切换候选编码并直接看数据预览，确认中文恢复正常后再导出 UTF-8。",
    example: { title: "同一份文件，用错编码会看到完全不同的文字", caption: "示意：确认姓名、部门等中文列正常后再导出。", headers: ["源编码", "看到的姓名", "处理建议"], rows: [["GBK / GB18030", "张三", "中文正常，可导出 UTF-8"], ["错误编码", "����", "切换编码后重新预览"]] },
    rulesTitle: "修复主要处理文字编码，导出时会规范文本文件结构",
    rules: ["支持 UTF-8、GBK / GB18030 和 Big5 三组常见编码，由你根据预览确认。", "输出统一使用 UTF-8；默认添加 BOM，方便部分 Windows Excel 直接识别中文。", "CSV 会自动识别常见逗号、分号或竖线分隔符；TSV 固定按 Tab 读取。", "默认保护以 =、+、-、@ 开头的字段，降低导出的 CSV 被表格软件当作公式执行的风险。"],
    outputTitle: "什么情况下算修复成功",
    output: "不要只看第一行标题。至少抽查姓名、地址、备注等包含中文的列，并核对行数、分隔列数和特殊符号。工具会解析后重新生成 CSV / TSV，因此分隔符、引号和换行写法可能被规范化，但不会主动修改字段内容。导出 UTF-8 后，再用实际要交付的 Excel、WPS 或业务系统重新打开一次。",
    stepsTitle: "推荐按这个顺序排查",
    steps: ["选择乱码的 CSV 或 TSV；如果默认 UTF-8 预览不正常，切换 GBK / GB18030 或 Big5。", "观察有限预览，确认中文、标点和列边界都恢复正常。", "选择输出 CSV 或 TSV，下载 UTF-8 结果并用目标软件复查。"],
    notes: ["如果三个编码预览都不正常，原文件可能不是这些编码，或文件本身已经损坏。", "“æµ‹è¯•”一类乱码往往是 UTF-8 字节被按其他编码显示；“����”通常表示解码时出现无法表示的字节。", "编码修复不会恢复已经在上游系统中被错误替换成问号或乱码字符的数据。"],
    limits: "当前版本不做不可靠的自动编码判定，也不支持 UTF-16、Shift_JIS 等更多编码。它不是逐字节原样转码器：导出时会重新序列化 CSV / TSV，所以分隔符和引号格式可能变化。遇到特殊来源文件，建议先确认导出系统的编码设置。",
    faq: [["为什么不直接自动识别编码？", "短 CSV、纯数字文件或中英文混合文件常常无法可靠区分 GBK、Big5 等编码。让用户看预览确认，比给出错误的“自动识别成功”更稳妥。"], ["UTF-8 BOM 是什么？", "它是文件开头的一个标记。现代程序通常不需要，但部分 Windows Excel 更容易借它判断 CSV 使用 UTF-8。"], ["修复乱码会改变前导 0 吗？", "本工具按文本重新编码，不主动把字段转成数字；但目标表格软件再次打开 CSV 时仍可能自行识别数字，因此重要编号建议转成 XLSX 后再交付。"]],
    related: [["/csv-excel-converter/", "修好编码后需要保留编号格式或改成 XLSX，可继续使用 CSV 转 Excel。"], ["/excel-deduplicate/", "乱码修复后要清理重复名单，可继续使用 Excel / CSV 去重。"]]
  },
  dedupe: {
    notesTitle: "避免误删的检查项",
    faqTitle: "去重时常见的疑问",
    relatedTitle: "去重后继续处理",
    privacy: "去重规则在本机执行，名单内容不会上传或留存在本站。",
    guideTitle: "去重前，先想清楚哪几列代表同一条记录",
    guide: "名单里姓名相同，不一定是同一个人；订单号相同，通常才表示同一笔订单。选择多列后，只有这些列的组合都一样才算重复。比较规则会影响结果，所以工具会把删掉的行单独留下，方便你回头检查。",
    example: { title: "按更新时间直接保留最新记录", caption: "示例：以客户编号去重，并按更新时间保留 2026-09-08 这一条。", headers: ["客户编号", "状态", "更新时间"], rows: [["C018", "待确认", "2026-09-01"], ["C018", "已完成", "2026-09-08"]] },
    rulesTitle: "哪些内容会被判成重复",
    rules: ["可按一列、多列或整行判断；手机上可以直接勾选多列。", "勾选“忽略首尾空格”后，“华东”和“ 华东 ”视为相同。", "空值会参与匹配；两行选定列都为空时，它们可能互相重复。", "选择“按日期保留最新/最早”时，需要指定日期列；无法识别的日期会停止处理，避免静默选错记录。"],
    outputTitle: "结果不是简单地把行删掉",
    output: "下载文件包含“去重结果”和“重复行”两个工作表。重复行末尾会标出它与哪一条数据重复，适合交给同事复核，而不是处理完就找不回原记录。",
    stepsTitle: "建议这样操作",
    steps: ["载入文件，勾选能稳定识别记录的列。", "选择保留第一条、最后一条，或按日期列保留最新/最早，并确认空格、大小写规则。", "查看保留数和重复数，再下载带审计表的结果。"],
    notes: ["按日期保留最新/最早时，日期需使用 YYYY-MM-DD、YYYY/MM/DD，可带 HH:mm:ss。", "工作簿有多张表时，只检查排在最前的一张。", "重复表头会自动改成唯一名称，例如“姓名 (2)”。"],
    limits: "工具不会猜测哪个字段更可信，也不会自动合并两行中的非空内容。选错依据列可能误删，因此重要名单务必查看重复行工作表。",
    faq: null,
    extraTitle: "日期模式会主动检查异常值",
    extra: "选择按日期保留最新或最早后，工具会直接比较指定日期列，不要求你提前排序。如果重复组中出现空日期或无法识别的日期格式，会停止处理并指出数据行，避免把错误日期当成正常值继续去重。",
    related: [["/excel-compare/", "想核对去重前后哪些记录发生变化，可用 Excel 表格差异对比。"], ["/excel-split-by-column/", "名单整理完成后要按部门或门店分发，可按列值拆分成多个文件。"]]
  },
  columnCompare: {
    notesTitle: "两列对比前先确认",
    faqTitle: "两列对比常见问题",
    relatedTitle: "对比后继续处理",
    privacy: "比较过程在当前浏览器完成，两列内容不会上传到本站服务器。",
    guideTitle: "两列对比适合查名单差异，不是按行号逐行比较",
    guide: "例如 A 列是本月客户编号，B 列是上月客户编号。真正想知道的通常不是第 3 行和第 3 行是否一样，而是哪些编号两边都有、哪些只出现在其中一列。这个工具按值集合比较，因此排序不同不会制造假差异。",
    example: { title: "排序不同也能找到共有值", caption: "示例：A002 虽然不在同一行，仍会被识别为共有值。", headers: ["第一列", "第二列", "结果"], rows: [["A001", "A003", "A001 仅第一列"], ["A002", "A002", "A002 共有"], ["A004", "A005", "A005 仅第二列"]] },
    rulesTitle: "比较时采用这些规则",
    rules: ["默认忽略首尾空格，因此“ A001 ”和“A001”可视为同一个值。", "可选择忽略英文大小写；中文内容不受这个选项影响。", "默认忽略空白单元格，避免大量空值被当作共有项。", "同一列里重复出现的值只按一个唯一值参与集合比较，但结果会保留该值在原列中的出现次数。"],
    outputTitle: "结果会分成三类",
    output: "下载文件包含“共有值”“仅第一列”“仅第二列”三个工作表，并带上每个值在原列中的出现次数。这样既能查缺失项，也能看某个编号是否在一列中重复出现。",
    stepsTitle: "最常见的使用方法",
    steps: ["选择一份包含两列名单的 Excel、CSV 或 TSV。", "分别选择要比较的第一列和第二列，并确认空格、大小写和空值规则。", "查看三类数量和预览，确认后下载完整结果。"],
    notes: ["如果两列其实代表不同含义，例如姓名和手机号，不应该互相比较。", "排序变化不会影响结果，因为工具按值而不是按行号匹配。", "同一个值重复多次时，结果会显示出现次数，不会默默丢失重复信息。"],
    limits: "这是单列值集合对比，不会判断两列中的近似文本、拼写差异或同义词。例如“华东”和“华东区”仍会被视为不同值。",
    faq: null,
    extraTitle: "什么时候该用两列对比，什么时候该用版本对比",
    extra: "只想知道两列名单有哪些相同项和缺失项时，用两列对比更直接；如果要比较两份完整表格中同一条记录的多个字段变化，则应使用 Excel 表格差异对比。",
    related: [["/excel-compare/", "需要比较两份完整表格的新增、删除和字段修改时，用 Excel 表格差异对比。"], ["/excel-deduplicate/", "发现某一列内部有重复值时，可以先用 Excel / CSV 去重检查。"]]
  },
  merge: {
    notesTitle: "合并前值得检查",
    faqTitle: "合并文件常见问题",
    relatedTitle: "合并前后常用工具",
    privacy: "多份文件只在当前页面中合并，本站不会接收表格内容。",
    guideTitle: "列顺序不同，不代表不能合并",
    guide: "月报 A 的顺序可能是“门店、订单号、金额”，月报 B 却是“订单号、金额、门店”。按行合并时，工具看的是表头名称，不是列位置。某个文件没有的列会留空，多出来的列则会追加到结果右侧。",
    example: { title: "表头如何自动对齐", caption: "示例：两份来源不同的表会对齐为同一列序。", headers: ["文件", "原表头顺序", "合并后"], rows: [["华东.csv", "编号、部门、金额", "编号、部门、金额"], ["华南.csv", "部门、编号、备注", "编号、部门、金额、备注"]] },
    rulesTitle: "两种合并方式别选反",
    rules: ["按行合并：所有数据进入一张表，同名表头自动对齐。", "按工作表合并：每个文件成为一个工作表，只读取每个 XLSX 的第一张表。", "文件列表中的上下顺序就是合并顺序，可以在处理前调整。", "空表头和重复表头会生成唯一列名，避免数据静默覆盖。"],
    outputTitle: "先看汇总数量，再查缺失列",
    output: "结果区会显示文件数、总数据行数和统一后的列数。若列数比预期多，通常是“客户名称”和“客户名”这类表头写法不一致，需要先统一命名再合并。",
    stepsTitle: "合并前的快速检查",
    steps: ["一次选择至少两个文件，确认列表顺序。", "根据用途选择按行合并或按工作表保留。", "生成预览，检查总行数与新增列，再下载工作簿。"],
    notes: ["所有输入都把第一行当作表头，文件中不要夹带标题说明行。", "一次最多选择 50 个文件，累计不能超过 200 MB。", "原有颜色、列宽、图表和宏不会进入新工作簿。"],
    limits: "“销售额”和“销售金额”会被视为两列，工具不会根据含义自动合并。先统一表头，通常比合并后再清理省事。",
    faq: null,
    extraTitle: "合并后突然多出列，先检查表头写法",
    extra: "这个工具只按表头文字对齐，不会把“客户名称”“客户名”或带隐藏空格的列自动认成同一个字段。合并前先统一常用列名，通常能减少结果中的空列，也能避免同一类数据被拆到两列。",
    related: [["/excel-compare/", "合并前要核对新版月报和旧版差异，可先用 Excel 表格差异对比。"], ["/excel-deduplicate/", "合并后担心重复记录，可继续按业务关键列去重。"]]
  },
  split: {
    notesTitle: "拆分前留意分组值",
    faqTitle: "拆分文件常见问题",
    relatedTitle: "拆分前后常用工具",
    privacy: "分组和打包都由浏览器完成，关闭页面后处理状态随即清空。",
    guideTitle: "适合拆部门表，也适合拆门店和负责人",
    guide: "一张总表要分别发给多个部门时，手工筛选和复制很容易漏行。选择“部门”列后，相同部门的数据会进入同一个 XLSX。工具先显示分组数量，确认没有异常空值后，再一次下载 ZIP。",
    example: { title: "分组值会变成文件名", caption: "示例：三行数据最终生成两份表。", headers: ["编号", "部门", "生成文件"], rows: [["A001", "华东", "华东.xlsx"], ["A002", "华南", "华南.xlsx"], ["A003", "华东", "华东.xlsx"]] },
    rulesTitle: "文件名和空值这样处理",
    rules: ["分组列内容完全相同的行放入同一文件，并保留表头。", "空白分组统一进入“空值.xlsx”，不会悄悄丢弃。", "斜杠、冒号等不能用于文件名的字符会替换为下划线。", "清理后重名的分组会追加数字后缀；一次最多生成 500 个文件。"],
    outputTitle: "ZIP 里应该有什么",
    output: "结果预览列出每个分组及对应行数。下载后先解压并抽查人数较多、含空值和名称相近的分组，确认没有因为空格或不同写法被拆成两份。",
    stepsTitle: "拆分时别漏掉这一步",
    steps: ["载入总表，选择部门、门店或负责人等分组列。", "查看分组数量和行数，特别留意“空值”分组。", "生成 ZIP，解压后抽查文件名和每份表的表头。"],
    notes: ["分组值会忽略首尾空格，因此“华东”和“华东 ”会进入同一文件。", "有多张工作表时，请把要拆分的表移到第一张或单独另存。", "每个输出文件只包含数据值，不复制复杂样式。"],
    limits: "工具按单列原值分组，不会识别同义词。例如“直营一部”和“一部”会生成两份文件。",
    faq: null,
    extraTitle: "最容易漏掉的是空值和名称不统一",
    extra: "例如“华东”“华东区”和“华东 ”未必都代表同一个业务分组。工具会去掉首尾空格，但不会判断简称或同义词。正式分发前先看分组数量，并抽查名称相近的组，比下载后逐个找错更省时间。",
    related: [["/excel-deduplicate/", "拆分前如果总表有重复记录，建议先去重，避免重复数据进入多个分发文件。"], ["/excel-merge/", "以后需要把各部门回传文件重新汇总，可用 Excel 多文件合并。"]]
  },
  compare: {
    notesTitle: "对比可信度取决于关键列",
    faqTitle: "版本对比常见问题",
    relatedTitle: "对比前后常用工具",
    privacy: "两个版本只在本地读取和比较，不会传给远端服务。",
    guideTitle: "对比表格，关键不是行号，而是唯一编号",
    guide: "两个版本只要重新排序，按行号对比就会产生大量假差异。这里会用订单 ID、员工编号等关键列先找到同一条记录，再比较其他字段。关键列必须唯一；发现重复值时，工具会停止并提示对应数据行。对修改记录还会生成字段级明细，直接显示旧值和新值。",
    example: { title: "顺序变化不会算修改", caption: "示例：ID 相同才会继续比较状态。", headers: ["ID", "旧版", "新版", "分类"], rows: [["A01", "待处理", "已完成", "修改"], ["A02", "已完成", "无此记录", "删除"], ["A03", "无此记录", "待处理", "新增"]] },
    rulesTitle: "四类结果是怎么判定的",
    rules: ["新版有、旧版没有的关键列值记为新增。", "旧版有、新版没有的关键列值记为删除。", "两边都有但其他列内容不同的记为修改，并列出变更列名。", "每个发生变化的字段还会单独记录关键值、字段名、旧值和新值。", "两边内容相同的记录放入未变化工作表，行顺序变化不算差异。"],
    outputTitle: "下载后先处理修改项",
    output: "结果工作簿包含新增、删除、修改、字段差异和未变化五张表。建议先看“字段差异”，它会逐项列出关键值、字段、旧值和新值；再回到“修改”表查看整行上下文，最后确认新增和删除是否来自真实业务变化。",
    stepsTitle: "得到可信差异的顺序",
    steps: ["分别选择旧版、新版，并确认两张表都有同名关键列。", "选择能唯一识别记录的字段，按需忽略空格或英文大小写。", "查看四类数量，下载结果后核对重复关键列和空关键列。"],
    notes: ["关键列有重复值时不会继续导出，请根据提示先去重。", "旧版和新版都只读取各自排在第一位的工作表。", "新版新增的列会参与比较，并可能让多条记录进入修改分类。"],
    limits: "当前版本只能选择一个关键列。若业务需要“门店 + 商品编码”这样的组合键，请先新增一列组合编号。",
    faq: [["调整行顺序会被当作修改吗？", "不会。记录按关键列匹配，单纯排序不会制造差异。"], ["为什么修改数量比预期多？", "先检查新版是否多了列、关键列格式是否一致，以及空格和英文大小写选项是否符合数据情况。"], ["关键列有重复值会怎样？", "工具会停止比较，并提示重复值所在的数据行。先去重或换用真正唯一的关键列，再重新运行。"]],
    related: [["/excel-two-column-compare/", "如果只想比较两列名单的相同项和缺失项，用 Excel 两列对比更直接。"], ["/excel-deduplicate/", "关键列存在重复值时，先用 Excel / CSV 去重检查重复记录。"], ["/excel-merge/", "需要把多个版本或来源文件先汇总，再做后续核对时，可用 Excel 多文件合并。"]]
  }
};

const runLabels = {
  converter: "转换并预览",
  encodingFix: "修复编码并预览",
  dedupe: "去重并预览",
  columnCompare: "对比两列并预览",
  merge: "合并并预览",
  split: "拆分并预览",
  compare: "对比版本并预览"
};

function toolPage(tool) {
  const info = content[tool.id];
  const example = `<div class="example-block"><h2>${info.example.title}</h2><div class="table-wrap" tabindex="0" aria-label="表格示例，可横向滚动"><table><caption>${info.example.caption}</caption><thead><tr>${info.example.headers.map((value) => `<th scope="col">${value}</th>`).join("")}</tr></thead><tbody>${info.example.rows.map((row) => `<tr>${row.map((value) => `<td>${value}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  const faq = info.faq ? `<h2>${info.faqTitle}</h2><div class="faq">${info.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>` : "";
  const related = `<h2>${info.relatedTitle}</h2><ul class="related-context">${info.related.map(([href, text]) => `<li><a href="${href}">${text}</a></li>`).join("")}</ul>`;
  const intentAnswers = {
    converter: `<div class="answer-block"><strong>CSV 转 Excel 怎么避免前导 0 和长数字变化？</strong><p>订单号、手机号、邮编等字段应按文本写入 XLSX，避免 00123 变成 123，或长编号被显示成科学计数法。这个转换器会把 CSV 字段按文本写入 XLSX；如果原 CSV 已经出现中文乱码，先用专门的乱码修复工具确认源编码。</p></div>`,
    encodingFix: `<div class="answer-block"><strong>CSV 中文乱码怎么修复？</strong><p>先不要改内容本身，而要确认原 CSV 的文字编码。依次尝试 UTF-8、GBK / GB18030 或 Big5，预览中中文恢复正常后，再把同一份数据重新保存为 UTF-8 CSV / TSV。</p></div>`,
    dedupe: `<div class="answer-block"><strong>Excel 去重时怎么保留最新一条？</strong><p>以订单号、客户编号等稳定字段作为去重依据，选择“按日期保留最新”，再指定更新时间列即可。工具会直接比较日期，不需要先手动排序；遇到空日期或无法识别的日期会停止处理并提示数据行。</p></div>`,
    columnCompare: `<div class="answer-block"><strong>Excel 两列怎么快速找出相同项和不同项？</strong><p>不要按行号逐行比较，而是把两列当成两个值集合。工具会分别列出两边都有的值、只在第一列出现的值和只在第二列出现的值；即使两列排序不同，也不会造成误报。</p></div>`,
    merge: `<div class="answer-block"><strong>多个 Excel 的列顺序不同还能合并吗？</strong><p>可以。按行合并时会按表头名称对齐，而不是按列位置硬拼；但“客户名”和“客户名称”会被视为不同字段，合并前最好先统一列名。</p></div>`,
    split: `<div class="answer-block"><strong>这里的“按列拆分”是什么意思？</strong><p>不是把一列文字拆成多列，而是根据某一列的值，把整张总表分成多个独立文件。例如选择“部门”列后，每个部门得到一份 XLSX。</p></div>`,
    compare: `<div class="answer-block"><strong>两个 Excel 版本怎么对比才不会因为排序变化误报？</strong><p>不要按行号比较。先选择订单号、员工编号等唯一字段匹配同一条记录，再比较其他列；单纯调整行顺序不会被算作修改。发生修改时，结果还会逐项列出字段名、旧值和新值。</p></div>`
  };
  const intentAnswer = intentAnswers[tool.id] || "";
  const body = `<section class="tool-header"><div class="shell"><div class="breadcrumbs"><a href="/">首页</a> / ${tool.navName}</div><p class="eyebrow">免费使用 · 浏览器本地处理</p><h1>${tool.name}</h1><p class="lead">${tool.description} ${info.privacy}</p></div></section>
  <section class="workspace"><div class="shell workspace-grid"><div class="workbench"><div class="step"><div class="step-title"><b>1</b><h2>选择文件与规则</h2></div>${controls[tool.id]}<div id="status" class="status" role="status" aria-live="polite" aria-atomic="true"></div><div id="progress" class="progress" role="progressbar" aria-label="处理进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div></div><div class="step"><div class="step-title"><b>2</b><h2>开始处理</h2></div><div class="actions"><button id="run" class="button primary" type="button" aria-describedby="run-help" disabled>${runLabels[tool.id] || "处理并预览"}</button><a class="button" href="${tool.sample}" download rel="nofollow">下载简单样例</a></div><p id="run-help" class="field-help">文件准备完成且当前规则有效后，此按钮会自动启用。</p></div><div id="result" class="step result" role="region" aria-labelledby="result-title" tabindex="-1"><div class="step-title"><b>3</b><h2 id="result-title">检查并下载</h2></div><div id="summary" class="result-summary"></div><p class="preview-note"><strong id="preview-label">当前预览</strong> · 最多显示前 12 行、前 12 列；下载结果仍包含本次处理的完整数据。宽表可左右滚动。</p><div id="preview" class="table-wrap" tabindex="0" aria-label="处理结果预览，可横向滚动"></div><div class="actions result-actions"><button id="download" class="button primary" type="button" disabled>下载处理结果</button><button id="reset-tool" class="button" type="button">处理另一份文件</button></div></div></div><aside class="side-note"><h2>${info.notesTitle}</h2><ul>${info.notes.map((note) => `<li>${note}</li>`).join("")}</ul><div class="notice"><strong>请保留原文件</strong><p>${info.limits}</p></div></aside></div></section>${promoBanner("tool_primary")}
  <section class="section white"><div class="shell content">${intentAnswer}<h2>${info.guideTitle}</h2><p>${info.guide}</p>${example}<h2>${info.rulesTitle}</h2><ul>${info.rules.map((rule) => `<li>${rule}</li>`).join("")}</ul><h2>${info.outputTitle}</h2><p>${info.output}</p><h2>${info.stepsTitle}</h2><ol>${info.steps.map((step) => `<li>${step}</li>`).join("")}</ol>${info.extra ? `<h2>${info.extraTitle}</h2><p>${info.extra}</p>` : ""}${faq}${secondarySponsorTools.has(tool.id) ? sponsorCard("tool_secondary") : ""}${related}</div></section>`;
  const schemas = [{ "@context": "https://schema.org", "@type": "WebApplication", name: tool.name, applicationCategory: "BusinessApplication", operatingSystem: "Any", browserRequirements: "需要支持 JavaScript 的现代浏览器", inLanguage: "zh-CN", dateModified: tool.modified, url: `${site}/${tool.slug}/`, description: tool.description, isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" } }, { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "首页", item: site }, { "@type": "ListItem", position: 2, name: tool.navName, item: `${site}/${tool.slug}/` }] }];
  return layout({ title: tool.title, description: tool.description, pathName: `/${tool.slug}/`, body, toolId: tool.id, schemaData: schemas });
}

function policyPage(kind) {
  const pages = {
    about: {
      title: "关于与反馈",
      description: "了解表理工具做什么、文件如何处理、当前支持范围以及问题反馈方式。",
      modified: pageModified["/about/"],
      html: `<h2>表理工具做什么</h2><p>表理工具是一组面向日常办公的 Excel 与 CSV 小工具，重点解决格式转换、CSV 乱码修复、重复记录清理、两列对比、多文件合并、按部门或门店拆分，以及两个版本的数据差异核对。每个页面尽量只解决一个明确任务，不把简单操作做成复杂的在线表格编辑器。</p><h2>文件在哪里处理</h2><p>表格解析、整理和导出默认在当前浏览器中完成，本站不提供文件上传接口。处理重要资料前仍建议保留原文件，并在下载后抽查关键列、行数和日期等容易出错的内容。</p><h2>当前支持范围</h2><p>目前支持 XLSX、CSV 和 TSV。旧版 XLS 需要先另存为 XLSX；每个 XLSX 默认只读取第一张工作表。宏、图表、数据透视表、复杂样式和外部链接不会完整保留，因此这里更适合整理数据，不适合复制工作簿版式。</p><h2>反馈问题</h2><p>如果处理结果不符合预期，请记录浏览器版本、文件格式、使用的工具和复现步骤。不要在公开反馈中上传客户名单、财务数据、身份证明或其他敏感原文件。可以前往 <a href="https://github.com/biaoli-tools/biaoli-tools.github.io/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a> 提交问题。</p>`
    },
    privacy: {
      title: "隐私政策",
      description: "说明表理工具如何在浏览器本地处理文件，以及访问统计和推广链接的隐私边界。",
      modified: pageModified["/privacy/"],
      html: `<p>更新日期：${formatChineseDate(pageModified["/privacy/"])}</p><h2>文件处理</h2><p>表理工具的表格解析、整理和导出默认在你的浏览器中完成。本站不提供文件上传接口，也不主动保存文件名、表头、单元格内容或导出结果。</p><h2>本地临时数据</h2><p>处理状态只存在于当前页面内存中。刷新或关闭页面后会清空。下载的结果由浏览器保存到你选择的位置。</p><h2>访问统计</h2><p>本站使用 Google Analytics 4 了解页面访问量、会话、访问来源以及浏览器和设备类别。Google Analytics 可能通过第一方 Cookie 区分用户与会话，并根据 IP 地址生成粗略地区信息。本站不会主动把文件名、列名、单元格内容或导出结果发送给统计服务。若浏览器明确发送 Global Privacy Control（GPC）或 Do Not Track（DNT）信号，本站不会加载 Google Analytics。你也可以通过浏览器设置限制或删除 Cookie；更多处理方式见 <a href="https://policies.google.com/privacy" rel="noopener noreferrer">Google 隐私权政策</a>。</p><h2>第三方推广</h2><p>本站部分页面可能展示明确标注的第三方推广链接。推广内容与本站工具功能相互独立，不会读取或接收你在工具中选择的表格文件、文件名、列名、单元格内容或导出结果。点击推广链接后会离开本站，之后的数据处理以对应第三方网站的隐私政策为准。</p><h2>推广效果统计</h2><p>在 Google Analytics 可用时，本站可能记录推广位的展示和点击，用于评估展示效果。记录仅包含推广位标识、所在页面等基础信息，不包含你处理的表格数据。若浏览器启用 GPC 或 DNT，Google Analytics 不会加载，相应统计事件也不会发送。</p><h2>你需要留意的设备环境</h2><p>浏览器扩展、操作系统和下载目录不受本站控制。请勿在公共或不受信任的设备上处理敏感资料，使用后也要检查下载目录中是否留有副本。</p>`
    },
    terms: {
      title: "使用条款",
      description: "表理工具的使用范围、文件兼容限制、推广链接和责任边界。",
      modified: pageModified["/terms/"],
      html: `<p>更新日期：${formatChineseDate(pageModified["/terms/"])}</p><h2>工具用途</h2><p>本站提供免费的浏览器端表格整理功能。你应确保有权处理所选择的文件，并对下载结果进行必要核对。</p><h2>兼容边界</h2><p>当前版本支持 XLSX、CSV 和 TSV，不处理旧版 XLS、加密或损坏的工作簿。日期会整理为统一格式，公式保存为公式文本；宏、图表、数据透视表、外部链接和复杂样式不会保留。</p><h2>重要数据</h2><p>处理前请保留原文件。财务结算、法律材料或其他高风险用途需要人工复核，不能只依赖自动生成的结果。</p><h2>推广链接</h2><p>首页和核心工具页标注“推广”的横幅会跳转到第三方网站。本站不对第三方产品的速度、安全性、可用性或适用性作保证；购买或使用前请自行核对对方的服务条款、隐私政策和退款规则。</p><h2>第三方组件</h2><p>本站使用的第三方组件及许可见<a href="/licenses/">第三方许可页面</a>。</p>`
    },
    licenses: {
      title: "第三方组件许可",
      description: "表理工具所使用第三方组件的版本、版权和许可说明。",
      modified: pageModified["/licenses/"],
      html: `<p>更新日期：${formatChineseDate(pageModified["/licenses/"])}</p><h2>JSZip 3.10.1</h2><p>Copyright © 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso。本站按 MIT License 使用，项目内保留完整许可文本。</p><h2>项目自有代码</h2><p>除上述第三方组件外，站点其余自有代码的授权以仓库实际提供的项目许可证为准；当前仓库未另行声明开源许可证时，不应将第三方组件许可证理解为对本站自有代码的授权。</p><p>XLSX 基础读写由本站轻量模块实现，不含第三方表格解析库。组件名称与商标归各自权利人所有。</p>`
    }
  };
  const page = pages[kind];
  return layout({ title: `${page.title} | 表理工具`, description: page.description, pathName: `/${kind}/`, body: `<section class="policy"><div class="shell content"><h1>${page.title}</h1>${page.html}</div></section>`, indexable: kind !== "licenses" });
}

async function writePage(relative, html) {
  const target = path.join(out, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
}

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, "assets", "vendor"), { recursive: true });
await cp(path.join(root, "src", "styles.css"), path.join(out, "assets", "styles.css"));
await cp(path.join(root, "src", "js", "app.js"), path.join(out, "assets", "app.js"));
await cp(path.join(root, "src", "js", "data.js"), path.join(out, "assets", "data.js"));
const toolsSource = (await readFile(path.join(root, "src", "js", "tools.js"), "utf8"))
  .replace('"./data.js"', `"./data.js?v=${assetVersion}"`)
  .replace('"./xlsx-lite.js"', `"./xlsx-lite.js?v=${assetVersion}"`)
  .replace('"/assets/vendor/jszip.min.js"', `"/assets/vendor/jszip.min.js?v=${assetVersion}"`);
await writeFile(path.join(out, "assets", "tools.js"), toolsSource);
await cp(path.join(root, "src", "js", "xlsx-lite.js"), path.join(out, "assets", "xlsx-lite.js"));
await cp(path.join(root, "src", "vendor"), path.join(out, "assets", "vendor"), { recursive: true });
await cp(path.join(root, "src", "assets"), path.join(out, "assets"), { recursive: true });
await cp(path.join(root, "src", "samples"), path.join(out, "samples"), { recursive: true });

await writePage("index.html", homePage());
for (const tool of tools) await writePage(path.join(tool.slug, "index.html"), toolPage(tool));
for (const kind of ["about", "privacy", "terms", "licenses"]) await writePage(path.join(kind, "index.html"), policyPage(kind));
await writePage("404.html", layout({ title: "页面未找到 | 表理工具", description: "你访问的页面不存在。", pathName: "/404.html", indexable: false, canonicalize: false, body: `<section class="not-found"><div><p class="eyebrow">404</p><h1>页面没有找到</h1><p>地址可能已经改变。回到首页后，可以重新选择需要的表格工具。</p><a class="button primary" href="/">返回首页</a></div></section>` }));

const urls = ["/", ...tools.map((tool) => `/${tool.slug}/`), "/about/", "/privacy/", "/terms/"];
await writeFile(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `\n  <url><loc>${site}${url}</loc><lastmod>${pageModified[url]}</lastmod></url>`).join("")}\n</urlset>\n`);
await writeFile(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /samples/\n\nSitemap: ${site}/sitemap.xml\n`);
await writeFile(path.join(out, ".nojekyll"), "");

console.log(`Built ${urls.length + 2} pages in ${out}`);
