import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "_site");
const site = "https://biaoli-tools.github.io";
const buildDate = new Date().toISOString().slice(0, 10);
const chineseBuildDate = `${buildDate.slice(0, 4)} 年 ${Number(buildDate.slice(5, 7))} 月 ${Number(buildDate.slice(8, 10))} 日`;

const tools = [
  { slug: "csv-excel-converter", id: "converter", name: "CSV / Excel 转换", short: "CSV、TSV 与 XLSX 互转", description: "在浏览器本地完成 CSV、TSV 与 XLSX 格式转换，可选择中文编码并保留长数字文本。", sample: "/samples/converter-sample.csv" },
  { slug: "excel-deduplicate", id: "dedupe", name: "Excel / CSV 去重", short: "按一列或多列查找重复项", description: "按单列、多列或整行去重，可保留首条或末条，并导出重复行审计表。", sample: "/samples/deduplicate-sample.csv" },
  { slug: "excel-merge", id: "merge", name: "Excel 多文件合并", short: "按行或工作表合并多个文件", description: "批量合并 Excel 与 CSV 文件，自动对齐不同顺序的同名表头，或保留为独立工作表。", sample: "/samples/merge-a.csv" },
  { slug: "excel-split-by-column", id: "split", name: "Excel 按列拆分", short: "按部门、门店或分类批量导出", description: "选择一列作为分组依据，将表格拆成多个 Excel 文件并打包为 ZIP 下载。", sample: "/samples/split-sample.csv" },
  { slug: "excel-compare", id: "compare", name: "表格差异对比", short: "按关键列找出新增、删除和修改", description: "按 ID 等关键列匹配两个版本，避免行顺序变化造成误报，并导出分类结果。", sample: "/samples/compare-old.csv" }
];

function schema(data) {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}

function layout({ title, description, pathName = "/", body = "", toolId = "", schemaData = null, indexable = true, canonicalize = true }) {
  const canonical = `${site}${pathName}`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  ${canonicalize ? `<link rel="canonical" href="${canonical}">` : ""}
  ${indexable ? "" : '<meta name="robots" content="noindex,follow">'}
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
  <link rel="stylesheet" href="/assets/styles.css">
  ${schemaData ? `<script type="application/ld+json">${schema(schemaData)}</script>` : ""}
</head>
<body${toolId ? ` data-tool="${toolId}"` : ""}>
  <a class="skip-link" href="#main">跳到主要内容</a>
  <header class="site-header">
    <nav class="nav" aria-label="主导航">
      <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">${"<i></i>".repeat(9)}</span>表理工具</a>
      <button class="nav-toggle" type="button" aria-label="打开导航" aria-expanded="false">☰</button>
      <div class="nav-links">
        <a href="/#tools">全部工具</a>
        <a href="/about/">关于与反馈</a>
        <a href="/privacy/">隐私政策</a>
        <a href="/terms/">使用条款</a>
      </div>
    </nav>
  </header>
  <main id="main">${body}</main>
  <footer class="site-footer">
    <div class="shell footer-grid">
      <p>© <span data-year></span> 表理工具 · 文件默认只在当前浏览器中处理</p>
      <div class="footer-links"><a href="/about/">关于与反馈</a><a href="/privacy/">隐私政策</a><a href="/terms/">使用条款</a><a href="/licenses/">开源许可</a></div>
    </div>
  </footer>
  <script type="module" src="/assets/app.js"></script>
  ${toolId ? '<script src="/assets/vendor/jszip.min.js"></script><script type="module" src="/assets/tools.js"></script>' : ""}
</body>
</html>`;
}

function sheetVisual() {
  const cells = ["", "A", "B", "C", "D", "1", "编号", "部门", "金额", "状态", "2", "A001", "华东", "1280", "已完成", "3", "A002", "华南", "860", "待核对", "4", "A003", "华北", "1560", "已完成"];
  return `<div class="sheet-visual" aria-label="整理后的表格示意"><div class="sheet-bar"><i></i><i></i><i></i></div><div class="sheet-grid">${cells.map((value, index) => `<span class="${index < 5 ? "head" : ""} ${index === 12 ? "active" : ""}">${value}</span>`).join("")}</div></div>`;
}

function homePage() {
  const body = `<section class="home-intro"><div class="shell"><div><p class="eyebrow">Excel 与 CSV 本地整理工具</p><h1>表理工具<br><span>把杂乱表格理清楚</span></h1><p class="lead">无需登录，不上传文件。转换、去重、合并、拆分和对比都在你的浏览器中完成。</p><div class="actions"><a class="button primary" href="#tools">选择工具 ↓</a><a class="button" href="/privacy/">了解本地处理</a></div></div>${sheetVisual()}</div></section>
  <section class="section" id="tools"><div class="shell"><div class="section-head"><h2>选择要完成的表格任务</h2><p>每个工具只解决一个明确问题。先检查规则与预览，再下载处理结果。</p></div><div class="tool-list">${tools.map((tool, index) => `<a class="tool-link" href="/${tool.slug}/"><span class="tool-number">0${index + 1}</span><div><h3>${tool.name}</h3><p>${tool.short}</p></div><span class="arrow" aria-hidden="true">→</span></a>`).join("")}</div></div></section>
  <section class="section white"><div class="shell"><div class="section-head"><h2>处理边界说清楚</h2><p>本地处理不等于没有限制。复杂工作簿仍建议保留原文件并核对结果。</p></div><div class="facts"><div class="fact"><strong>默认不上传</strong><span>文件内容留在当前浏览器，不经过本站服务器。</span></div><div class="fact"><strong>最多建议 50 MB</strong><span>20 MB 以上会提醒，实际承受能力取决于设备内存。</span></div><div class="fact"><strong>不承诺完整保真</strong><span>宏、图表、数据透视表和复杂样式可能无法保留。</span></div></div></div></section>`;
  return layout({ title: "表理工具 - Excel 与 CSV 本地整理工具", description: "免费的中文 Excel 与 CSV 本地处理工具，支持转换、去重、合并、按列拆分和差异对比，无需上传文件。", body, schemaData: { "@context": "https://schema.org", "@type": "WebSite", name: "表理工具", alternateName: "表理", url: site, description: "Excel 与 CSV 本地整理工具" } });
}

function commonUpload({ multiple = false, id = "files", label = "选择文件", accept = ".xlsx,.csv,.tsv" } = {}) {
  return `<label class="dropzone" for="${id}"><span><strong>${label}</strong><small>支持 XLSX、CSV、TSV；单个文件不超过 50 MB</small></span><input id="${id}" type="file" accept="${accept}"${multiple ? " multiple" : ""}></label>`;
}

function encodingControl() {
  return `<div class="field"><label for="encoding">CSV / TSV 文字编码</label><select id="encoding"><option value="utf-8">UTF-8</option><option value="gb18030">GBK / GB18030</option><option value="big5">Big5</option></select></div>`;
}

const controls = {
  converter: `${commonUpload()}<div class="field-grid control-spacing">${encodingControl()}<div class="field"><label for="output-format">输出格式</label><select id="output-format"><option value="auto">自动选择相反格式</option><option value="xlsx">Excel（XLSX）</option><option value="csv">CSV（UTF-8）</option><option value="tsv">TSV（UTF-8）</option></select></div><div class="field full"><div class="checks"><label><input id="protect-formulas" type="checkbox" checked>CSV 安全导出：公式型内容按文本保存</label></div></div></div>`,
  dedupe: `${commonUpload()}<div class="field-grid control-spacing"><fieldset class="field full"><legend>去重依据（可选择多列）</legend><div id="columns" class="column-options"><span class="field-placeholder">读取文件后显示列</span></div></fieldset>${encodingControl()}<div class="field"><label for="keep">重复时保留</label><select id="keep"><option value="first">第一条</option><option value="last">最后一条</option></select></div><div class="field full"><label>文字比较</label><div class="checks"><label><input id="trim" type="checkbox" checked>忽略首尾空格</label><label><input id="ignore-case" type="checkbox">忽略大小写</label></div></div></div>`,
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
    guideTitle: "先判断问题出在格式还是编码",
    guide: "同样叫“表格文件”，CSV 和 XLSX 的结构并不一样。CSV 本质上是一份纯文本，乱码通常与文字编码有关；XLSX 则是压缩后的工作簿。这个转换器适合整理系统导出的名单、订单和报表，不适合拿来复制带图表、宏或复杂样式的工作簿。",
    example: { title: "前导 0 会怎样处理", caption: "示例：CSV 转 XLSX 后，编号继续按文本保存。", headers: ["编号", "姓名", "导出结果"], rows: [["001", "林青", "001"], ["00027", "周宁", "00027"]] },
    rulesTitle: "转换时采用这些规则",
    rules: ["CSV 和 TSV 的第一行作为表头；空表头会补成“第 1 列”这类名称。", "从 XLSX 读取日期时会转换成 YYYY-MM-DD；带时间的数据输出到秒。", "公式保留为以等号开头的公式文本，不在浏览器里重新计算。", "导出 CSV 时默认保护以 =、+、-、@ 开头的内容，避免打开文件时被当作公式执行。"],
    outputTitle: "下载前重点看三类列",
    output: "先抽查订单号、手机号等长数字，再看日期，最后核对原文件中的公式列。CSV 不包含多个工作表，XLSX 转 CSV 时只会使用第一个工作表。",
    stepsTitle: "实际转换只需三步",
    steps: ["选择 CSV、TSV 或 XLSX。旧版 XLS 需要先在表格软件中另存为 XLSX。", "若 CSV 中文显示异常，切换到 GBK / GB18030 或 Big5，页面会自动重新读取已选文件。", "确认有限预览和输出格式，再生成并下载结果。"],
    notes: ["20 MB 以上会出现性能提醒，单个文件上限为 50 MB。", "CSV 输出统一使用带 BOM 的 UTF-8，方便常见表格软件识别中文。", "复杂数字格式不会原样复制，请对照原文件抽查。"],
    limits: "转换解决的是数据交换，不是工作簿克隆。合并单元格、颜色、图表、数据透视表、宏和外部链接不会保留。",
    faq: [["CSV 转 Excel 后，手机号前面的 0 会丢失吗？", "不会主动去掉。CSV 字段会作为文本写入 XLSX，像 013800000001 这样的内容仍按原文字保存。"], ["为什么 CSV 打开是乱码？", "常见原因是导出系统使用 GBK。切换编码后，页面会自动按新编码重新读取当前文件。"], ["为什么日期和原文件显示得不完全一样？", "工具会把识别出的日期统一整理成容易核对的格式，不复制自定义年月日格式、颜色或货币样式。"]]
  },
  dedupe: {
    notesTitle: "避免误删的检查项",
    faqTitle: "去重时常见的疑问",
    relatedTitle: "去重后继续处理",
    privacy: "去重规则在本机执行，名单内容不会上传或留存在本站。",
    guideTitle: "去重前，先想清楚哪几列代表同一条记录",
    guide: "名单里姓名相同，不一定是同一个人；订单号相同，通常才表示同一笔订单。选择多列后，只有这些列的组合都一样才算重复。比较规则会影响结果，所以工具会把删掉的行单独留下，方便你回头检查。",
    example: { title: "保留最新记录的做法", caption: "示例：先按更新时间从旧到新排序，再选择保留最后一条。", headers: ["客户编号", "状态", "更新时间"], rows: [["C018", "待确认", "2026-09-01"], ["C018", "已完成", "2026-09-08"]] },
    rulesTitle: "哪些内容会被判成重复",
    rules: ["可按一列、多列或整行判断；手机上可以直接勾选多列。", "勾选“忽略首尾空格”后，“华东”和“ 华东 ”视为相同。", "空值会参与匹配；两行选定列都为空时，它们可能互相重复。", "保留第一条或最后一条只看当前行顺序，不会自动识别时间先后。"],
    outputTitle: "结果不是简单地把行删掉",
    output: "下载文件包含“去重结果”和“重复行”两个工作表。重复行末尾会标出它与哪一条数据重复，适合交给同事复核，而不是处理完就找不回原记录。",
    stepsTitle: "建议这样操作",
    steps: ["载入文件，勾选能稳定识别记录的列。", "设置保留第一条或最后一条，并确认空格、大小写是否忽略。", "查看保留数和重复数，再下载带审计表的结果。"],
    notes: ["如果要保留最新记录，请先按时间升序排列，再选择保留最后一条。", "工作簿有多张表时，只检查排在最前的一张。", "重复表头会自动改成唯一名称，例如“姓名 (2)”。"],
    limits: "工具不会猜测哪个字段更可信，也不会自动合并两行中的非空内容。选错依据列可能误删，因此重要名单务必查看重复行工作表。",
    faq: [["姓名相同能直接去重吗？", "不建议。更稳妥的做法是同时选择客户编号、手机号后四位等能区分记录的字段，但不要把真实敏感数据分享给无关人员。"], ["忽略大小写会影响中文吗？", "中文本身通常没有大小写差异，这个选项主要影响英文编号和邮箱。"], ["删除的行还能找回吗？", "能。工具不会覆盖原文件，下载结果里还会保留一张“重复行”工作表。"]]
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
    faq: [["列的前后顺序不同可以合并吗？", "可以，只要表头文字一致。工具会把同名列放到同一位置。"], ["为什么合并后多出很多空列？", "多数情况是表头存在空格、简称或不同写法。请检查新增列名称，必要时先在源文件中统一。"], ["一个工作簿里的所有工作表都会合并吗？", "不会。当前版本每个 XLSX 只读取第一张工作表；需要处理其他工作表时，请先单独另存。"]]
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
    faq: [["同一部门的记录会放在一起吗？", "会。工具会先去掉分组值首尾空格，再按完整文字分组；简称不同仍会分成两份。"], ["分组名称里有斜杠怎么办？", "斜杠会替换成下划线；替换后若出现同名文件，工具会自动加数字区分。"], ["为什么 ZIP 里有“空值.xlsx”？", "说明部分数据的分组列为空。保留这份表是为了让你发现问题，而不是直接忽略这些记录。"]]
  },
  compare: {
    notesTitle: "对比可信度取决于关键列",
    faqTitle: "版本对比常见问题",
    relatedTitle: "对比前后常用工具",
    privacy: "两个版本只在本地读取和比较，不会传给远端服务。",
    guideTitle: "对比表格，关键不是行号，而是唯一编号",
    guide: "两个版本只要重新排序，按行号对比就会产生大量假差异。这里会用订单 ID、员工编号等关键列先找到同一条记录，再比较其他字段。关键列必须唯一；发现重复值时，工具会停止并提示对应数据行。",
    example: { title: "顺序变化不会算修改", caption: "示例：ID 相同才会继续比较状态。", headers: ["ID", "旧版", "新版", "分类"], rows: [["A01", "待处理", "已完成", "修改"], ["A02", "已完成", "无此记录", "删除"], ["A03", "无此记录", "待处理", "新增"]] },
    rulesTitle: "四类结果是怎么判定的",
    rules: ["新版有、旧版没有的关键列值记为新增。", "旧版有、新版没有的关键列值记为删除。", "两边都有但其他列内容不同的记为修改，并列出变更列名。", "两边内容相同的记录放入未变化工作表，行顺序变化不算差异。"],
    outputTitle: "下载后先处理修改项",
    output: "结果工作簿分为新增、删除、修改和未变化四张表。通常先检查修改项的“变更列”，再确认新增和删除是否来自业务变化，而不是关键列格式不一致。",
    stepsTitle: "得到可信差异的顺序",
    steps: ["分别选择旧版、新版，并确认两张表都有同名关键列。", "选择能唯一识别记录的字段，按需忽略空格或英文大小写。", "查看四类数量，下载结果后核对重复关键列和空关键列。"],
    notes: ["关键列有重复值时不会继续导出，请根据提示先去重。", "旧版和新版都只读取各自排在第一位的工作表。", "新版新增的列会参与比较，并可能让多条记录进入修改分类。"],
    limits: "当前版本只能选择一个关键列。若业务需要“门店 + 商品编码”这样的组合键，请先新增一列组合编号。",
    faq: [["调整行顺序会被当作修改吗？", "不会。记录按关键列匹配，单纯排序不会制造差异。"], ["为什么修改数量比预期多？", "先检查新版是否多了列、关键列格式是否一致，以及空格和英文大小写选项是否符合数据情况。"], ["关键列有重复值会怎样？", "工具会停止比较，并提示重复值所在的数据行。先去重或换用真正唯一的关键列，再重新运行。"]]
  }
};

function toolPage(tool) {
  const info = content[tool.id];
  const example = `<div class="example-block"><h2>${info.example.title}</h2><div class="table-wrap"><table><caption>${info.example.caption}</caption><thead><tr>${info.example.headers.map((value) => `<th>${value}</th>`).join("")}</tr></thead><tbody>${info.example.rows.map((row) => `<tr>${row.map((value) => `<td>${value}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  const body = `<section class="tool-header"><div class="shell"><div class="breadcrumbs"><a href="/">首页</a> / ${tool.name}</div><p class="eyebrow">免费使用 · 浏览器本地处理</p><h1>${tool.name}</h1><p class="lead">${tool.description} ${info.privacy}</p></div></section>
  <section class="workspace"><div class="shell workspace-grid"><div class="workbench"><div class="step"><div class="step-title"><b>1</b><h2>选择文件与规则</h2></div>${controls[tool.id]}<div id="status" class="status" role="status" aria-live="polite"></div><div id="progress" class="progress" aria-hidden="true"><span></span></div></div><div class="step"><div class="step-title"><b>2</b><h2>开始处理</h2></div><div class="actions"><button id="run" class="button primary" type="button">处理并生成预览</button><a class="button" href="${tool.sample}" download>下载简单样例</a></div></div><div id="result" class="step result"><div class="step-title"><b>3</b><h2>检查并下载</h2></div><div id="summary" class="result-summary"></div><div id="preview" class="table-wrap"></div><div class="actions result-actions"><button id="download" class="button primary" type="button">下载处理结果</button></div></div></div><aside class="side-note"><h2>${info.notesTitle}</h2><ul>${info.notes.map((note) => `<li>${note}</li>`).join("")}</ul><div class="notice"><strong>请保留原文件</strong><p>${info.limits}</p></div></aside></div></section>
  <section class="section white"><div class="shell content"><h2>${info.guideTitle}</h2><p>${info.guide}</p>${example}<h2>${info.rulesTitle}</h2><ul>${info.rules.map((rule) => `<li>${rule}</li>`).join("")}</ul><h2>${info.outputTitle}</h2><p>${info.output}</p><h2>${info.stepsTitle}</h2><ol>${info.steps.map((step) => `<li>${step}</li>`).join("")}</ol><h2>${info.faqTitle}</h2><div class="faq">${info.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div><h2>${info.relatedTitle}</h2><p>${tools.filter((item) => item.id !== tool.id).slice(0, 3).map((item) => `<a href="/${item.slug}/">${item.name}</a>`).join(" · ")}</p></div></section>`;
  const schemas = [{ "@context": "https://schema.org", "@type": "WebApplication", name: tool.name, applicationCategory: "BusinessApplication", operatingSystem: "Any", browserRequirements: "需要支持 JavaScript 的现代浏览器", inLanguage: "zh-CN", dateModified: buildDate, url: `${site}/${tool.slug}/`, description: tool.description, isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" } }, { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "首页", item: site }, { "@type": "ListItem", position: 2, name: tool.name, item: `${site}/${tool.slug}/` }] }];
  return layout({ title: `${tool.name} - 浏览器本地处理 | 表理工具`, description: tool.description, pathName: `/${tool.slug}/`, body, toolId: tool.id, schemaData: schemas });
}

function policyPage(kind) {
  const pages = {
    about: { title: "关于与反馈", description: "了解表理工具的维护原则、测试方式、功能边界和问题反馈渠道。", html: `<p>规则与功能最近核对：2026 年 9 月 9 日</p><h2>为什么做这个站</h2><p>表理工具专门处理办公中反复出现的小麻烦：换格式、删重复、合并月报、按部门拆表，以及比较两个版本。首版没有做成完整的在线表格编辑器，因为这些任务更适合用边界清楚的小工具解决。</p><h2>怎么检查功能</h2><p>每个工具都配有虚构样例。构建过程会检查页面链接、标题与描述，数据测试覆盖 CSV 引号和换行、去重规则、差异分类、文件名清理、CSV 安全导出，以及 XLSX 文件结构。涉及日期、公式和大文件时，页面会直接说明限制，不用“完全兼容”这类说不准的话。</p><h2>如何反馈问题</h2><p>发现结果不符合预期时，请记录浏览器版本、文件格式和复现步骤，不要提交含客户、财务或身份信息的原文件。可以前往 <a href="https://github.com/biaoli-tools/biaoli-tools.github.io/issues" rel="noopener noreferrer">GitHub Issues</a> 反馈。</p><h2>更新记录</h2><p><strong>2026-09-09：</strong>补充 XLSX 日期与公式处理、CSV 安全导出、大文件提醒和五个工具的规则示例。</p>` },
    privacy: { title: "隐私政策", description: "说明表理工具如何在浏览器本地处理文件，以及未来接入统计或广告服务时的隐私边界。", html: `<p>更新日期：2026 年 9 月 9 日</p><h2>文件处理</h2><p>表理工具的表格解析、整理和导出默认在你的浏览器中完成。本站不提供文件上传接口，也不主动保存文件名、表头、单元格内容或导出结果。</p><h2>本地临时数据</h2><p>处理状态只存在于当前页面内存中。刷新或关闭页面后会清空。下载的结果由浏览器保存到你选择的位置。</p><h2>统计与广告</h2><p>当前版本没有配置访问统计或广告脚本。若以后接入，本站会先更新本页，说明服务商、Cookie、收集范围和退出方式；统计事件不得包含文件名、列名或单元格内容。</p><h2>你需要留意的设备环境</h2><p>浏览器扩展、操作系统和下载目录不受本站控制。请勿在公共或不受信任的设备上处理敏感资料，使用后也要检查下载目录中是否留有副本。</p>` },
    terms: { title: "使用条款", description: "表理工具的使用范围、文件兼容限制和责任边界。", html: `<p>更新日期：2026 年 9 月 9 日</p><h2>工具用途</h2><p>本站提供免费的浏览器端表格整理功能。你应确保有权处理所选择的文件，并对下载结果进行必要核对。</p><h2>兼容边界</h2><p>当前版本支持 XLSX、CSV 和 TSV，不处理旧版 XLS、加密或损坏的工作簿。日期会整理为统一格式，公式保存为公式文本；宏、图表、数据透视表、外部链接和复杂样式不会保留。</p><h2>重要数据</h2><p>处理前请保留原文件。财务结算、法律材料或其他高风险用途需要人工复核，不能只依赖自动生成的结果。</p><h2>开源组件</h2><p>本站使用的开源组件及许可见<a href="/licenses/">开源许可页面</a>。</p>` },
    licenses: { title: "开源许可", description: "表理工具内置开源组件的版本、版权和许可说明。", html: `<p>更新日期：2026 年 9 月 9 日</p><h2>JSZip 3.10.1</h2><p>Copyright © 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso。本站按 MIT License 使用，项目内保留完整许可文本。</p><h2>站点自有代码</h2><p>XLSX 基础读写由本站轻量模块实现，不含第三方表格解析库。它会把常见日期整理成可读文本，把公式保留为公式文本；数字格式、样式、宏和图表不在保留范围内。</p><p>组件名称与商标归各自权利人所有。</p>` }
  };
  const page = pages[kind];
  const currentHtml = page.html.replaceAll("2026 年 9 月 9 日", chineseBuildDate);
  return layout({ title: `${page.title} | 表理工具`, description: page.description, pathName: `/${kind}/`, body: `<section class="policy"><div class="shell content"><h1>${page.title}</h1>${currentHtml}</div></section>` });
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
await cp(path.join(root, "src", "js", "tools.js"), path.join(out, "assets", "tools.js"));
await cp(path.join(root, "src", "js", "xlsx-lite.js"), path.join(out, "assets", "xlsx-lite.js"));
await cp(path.join(root, "src", "vendor"), path.join(out, "assets", "vendor"), { recursive: true });
await cp(path.join(root, "src", "assets"), path.join(out, "assets"), { recursive: true });
await cp(path.join(root, "src", "samples"), path.join(out, "samples"), { recursive: true });

await writePage("index.html", homePage());
for (const tool of tools) await writePage(path.join(tool.slug, "index.html"), toolPage(tool));
for (const kind of ["about", "privacy", "terms", "licenses"]) await writePage(path.join(kind, "index.html"), policyPage(kind));
await writePage("404.html", layout({ title: "页面未找到 | 表理工具", description: "你访问的页面不存在。", pathName: "/404.html", indexable: false, canonicalize: false, body: `<section class="not-found"><div><p class="eyebrow">404</p><h1>页面没有找到</h1><p>地址可能已经改变。回到首页后，可以重新选择需要的表格工具。</p><a class="button primary" href="/">返回首页</a></div></section>` }));

const urls = ["/", ...tools.map((tool) => `/${tool.slug}/`), "/about/", "/privacy/", "/terms/", "/licenses/"];
await writeFile(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `\n  <url><loc>${site}${url}</loc><lastmod>${buildDate}</lastmod></url>`).join("")}\n</urlset>\n`);
await writeFile(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
await writeFile(path.join(out, ".nojekyll"), "");

console.log(`Built ${urls.length + 1} pages in ${out}`);
