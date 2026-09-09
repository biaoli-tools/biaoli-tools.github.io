import { LIMITS, compareRows, deduplicateRows, largeFileWarning, parseDelimited, sanitizeFileName, toDelimited } from "./data.js";
import { readXlsx, writeXlsx } from "./xlsx-lite.js";

const tool = document.body.dataset.tool;
const state = { files: [], tables: [], result: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function status(message, type = "") {
  const node = $("#status");
  node.textContent = message;
  node.className = `status show ${type}`;
}

function clearStatus() {
  const node = $("#status");
  if (node) node.className = "status";
}

function progress(value) {
  const bar = $("#progress span");
  if (bar) bar.style.width = `${value}%`;
}

function invalidateResult() {
  state.result = null;
  $("#result")?.classList.remove("show");
  if ($("#summary")) $("#summary").textContent = "";
  if ($("#preview")) $("#preview").textContent = "";
  progress(0);
}

function checkFile(file) {
  if (!file) throw new Error("请先选择文件。");
  if (file.size > LIMITS.maxFileBytes) throw new Error("单个文件不能超过 50 MB。请拆小后重试。");
  if (!/\.(csv|tsv|xlsx)$/i.test(file.name)) throw new Error("仅支持 CSV、TSV 和 XLSX 文件。旧版 XLS 请先在 Excel 中另存为 XLSX。");
}

function checkFileCollection(files) {
  if (files.length > LIMITS.maxFiles) throw new Error(`一次最多处理 ${LIMITS.maxFiles} 个文件。请分批操作。`);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > LIMITS.maxTotalFileBytes) throw new Error("所选文件累计不能超过 200 MB。请分批处理。");
}

function encoding() {
  return $("#encoding")?.value || "utf-8";
}

function decodeBuffer(buffer, encoding = "utf-8") {
  try { return new TextDecoder(encoding).decode(buffer); }
  catch { throw new Error(`浏览器不支持 ${encoding} 解码，请先将文件另存为 UTF-8。`); }
}

function uniqueHeaders(headers) {
  const counts = new Map();
  return headers.map((value, index) => {
    const base = String(value ?? "").trim() || `第 ${index + 1} 列`;
    const count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

async function readFile(file, encoding = "utf-8") {
  checkFile(file);
  const buffer = await file.arrayBuffer();
  if (/\.(csv|tsv)$/i.test(file.name)) {
    const text = decodeBuffer(buffer, encoding);
    const delimiter = /\.tsv$/i.test(file.name) ? "\t" : undefined;
    const rows = parseDelimited(text, delimiter);
    if (!rows.length) throw new Error(`${file.name} 没有可读取的数据。`);
    rows[0] = uniqueHeaders(rows[0]);
    return { name: file.name, sheetName: "数据", rows };
  }
  const workbook = await readXlsx(buffer, file.name);
  const sheetName = workbook.sheetName;
  const rows = workbook.rows;
  if (!rows.length) throw new Error(`${file.name} 的第一个工作表为空。`);
  rows[0] = uniqueHeaders(rows[0]);
  return { name: file.name, sheetName, rows, workbook };
}

function tablePreview(rows, extraHeader = null) {
  const target = $("#preview");
  if (!target) return;
  const data = rows.slice(0, LIMITS.previewRows + 1).map((row) => row.slice(0, LIMITS.previewColumns + (extraHeader ? 1 : 0)));
  const header = data.shift() || [];
  target.innerHTML = `<table><thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${data.map((row) => `<tr>${header.map((_, i) => `<td title="${escapeHtml(row[i] ?? "")}">${escapeHtml(row[i] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function fillSelect(node, headers, multiple = false) {
  node.innerHTML = headers.map((name, index) => `<option value="${index}"${multiple && index === 0 ? " selected" : ""}>${escapeHtml(name || `第 ${index + 1} 列`)}</option>`).join("");
}

function showResult(summary, rows) {
  $("#summary").innerHTML = summary;
  tablePreview(rows);
  $("#result").classList.add("show");
  $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function workbookBlob(sheets) {
  return writeXlsx(sheets);
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bindSingleUpload(onReady) {
  const input = $("#files");
  input.addEventListener("change", async () => {
    clearStatus();
    invalidateResult();
    state.files = [];
    state.tables = [];
    try {
      const file = input.files[0];
      checkFile(file);
      const warning = largeFileWarning([file]);
      status(warning || `正在读取 ${file.name}…`, warning ? "warning" : "");
      await new Promise((resolve) => requestAnimationFrame(resolve));
      progress(30);
      const table = await readFile(file, encoding());
      state.files = [file];
      state.tables = [table];
      progress(100);
      status(warning || `已读取 ${file.name}：${Math.max(0, table.rows.length - 1)} 行，${table.rows[0].length} 列。`, warning ? "warning" : "");
      onReady?.(table);
    } catch (error) {
      progress(0);
      status(error.message, "error");
    }
  });
}

function bindEncodingReload(inputs, { reload = true } = {}) {
  const control = $("#encoding");
  if (!control) return;
  control.addEventListener("change", () => {
    invalidateResult();
    if (!reload) {
      status("文字编码已切换，请重新处理已选文件。");
      return;
    }
    const selected = inputs.filter((input) => input?.files?.length);
    selected.forEach((input) => input.dispatchEvent(new Event("change", { bubbles: true })));
    if (!selected.length) status("已切换文字编码。选择 CSV 或 TSV 后会按新编码读取。");
  });
}

function fillColumnChecks(node, headers) {
  node.innerHTML = headers.map((name, index) => `<label><input type="checkbox" value="${index}"${index === 0 ? " checked" : ""}>${escapeHtml(name)}</label>`).join("");
}

function selectedIndexes(node) {
  return $$('input[type="checkbox"]:checked', node).map((input) => Number(input.value));
}

function initializeConverter() {
  bindSingleUpload((table) => tablePreview(table.rows));
  bindEncodingReload([$("#files")]);
  $("#run").addEventListener("click", async () => {
    invalidateResult();
    try {
      if (!state.tables[0]) throw new Error("请先选择一个表格文件。");
      progress(55);
      const source = state.tables[0];
      const requested = $("#output-format").value;
      const sourceCsv = /\.(csv|tsv)$/i.test(source.name);
      const format = requested === "auto" ? (sourceCsv ? "xlsx" : "csv") : requested;
      if (format === "xlsx") {
        state.result = { blob: await workbookBlob([{ name: "数据", rows: source.rows }]), name: `${sanitizeFileName(source.name.replace(/\.[^.]+$/, ""))}.xlsx` };
      } else {
        const delimiter = format === "tsv" ? "\t" : ",";
        const csv = `\ufeff${toDelimited(source.rows, delimiter, { protectFormulas: $("#protect-formulas").checked })}`;
        state.result = { blob: new Blob([csv], { type: "text/plain;charset=utf-8" }), name: `${sanitizeFileName(source.name.replace(/\.[^.]+$/, ""))}.${format}` };
      }
      progress(100);
      showResult(`<span><strong>${source.rows.length - 1}</strong> 行数据</span><span>输出：<strong>${format.toUpperCase()}</strong></span>`, source.rows);
    } catch (error) { status(error.message, "error"); }
  });
  $("#download").addEventListener("click", () => state.result && download(state.result.blob, state.result.name));
}

function initializeDedupe() {
  bindSingleUpload((table) => {
    fillColumnChecks($("#columns"), table.rows[0]);
    tablePreview(table.rows);
  });
  bindEncodingReload([$("#files")]);
  $("#run").addEventListener("click", async () => {
    invalidateResult();
    try {
      const table = state.tables[0];
      if (!table) throw new Error("请先选择一个表格文件。");
      const indexes = selectedIndexes($("#columns"));
      if (!indexes.length) throw new Error("至少选择一列作为去重依据。");
      const options = { keep: $("#keep").value, trim: $("#trim").checked, ignoreCase: $("#ignore-case").checked };
      const result = deduplicateRows(table.rows, indexes, options);
      state.result = { blob: await workbookBlob([{ name: "去重结果", rows: result.kept }, { name: "重复行", rows: result.duplicates }]), name: "表格去重结果.xlsx" };
      showResult(`<span>保留 <strong>${result.kept.length - 1}</strong> 行</span><span>发现重复 <strong>${result.duplicates.length - 1}</strong> 行</span>`, result.kept);
    } catch (error) { status(error.message, "error"); }
  });
  $("#download").addEventListener("click", () => state.result && download(state.result.blob, state.result.name));
}

function renderFileList() {
  const list = $("#file-list");
  if (!list) return;
  list.innerHTML = state.files.map((file, index) => `<div class="file-item"><span>${escapeHtml(file.name)} · ${(file.size / 1024).toFixed(1)} KB</span><span class="file-actions"><button class="icon-button" data-up="${index}" aria-label="上移" title="上移">↑</button><button class="icon-button" data-down="${index}" aria-label="下移" title="下移">↓</button><button class="icon-button" data-remove="${index}" aria-label="移除" title="移除">×</button></span></div>`).join("");
  $$('[data-up]').forEach((button) => button.addEventListener("click", () => moveFile(Number(button.dataset.up), -1)));
  $$('[data-down]').forEach((button) => button.addEventListener("click", () => moveFile(Number(button.dataset.down), 1)));
  $$('[data-remove]').forEach((button) => button.addEventListener("click", () => {
    state.files.splice(Number(button.dataset.remove), 1);
    invalidateResult();
    renderFileList();
    status(`当前保留 ${state.files.length} 个文件，请重新处理。`);
  }));
}

function moveFile(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= state.files.length) return;
  [state.files[index], state.files[target]] = [state.files[target], state.files[index]];
  invalidateResult();
  renderFileList();
  status("文件顺序已调整，请重新处理。");
}

function initializeMerge() {
  $("#files").addEventListener("change", () => {
    try {
      invalidateResult();
      state.files = [...$("#files").files];
      state.files.forEach(checkFile);
      checkFileCollection(state.files);
      renderFileList();
      const warning = largeFileWarning(state.files);
      status(warning || `已选择 ${state.files.length} 个文件，可调整合并顺序。`, warning ? "warning" : "");
    } catch (error) {
      state.files = [];
      $("#files").value = "";
      renderFileList();
      status(error.message, "error");
    }
  });
  bindEncodingReload([$("#files")], { reload: false });
  $("#run").addEventListener("click", async () => {
    invalidateResult();
    try {
      if (state.files.length < 2) throw new Error("请至少选择两个文件。");
      progress(10);
      const files = [...state.files];
      const tables = [];
      for (let i = 0; i < files.length; i += 1) {
        tables.push(await readFile(files[i], encoding()));
        progress(10 + ((i + 1) / files.length) * 55);
      }
      const mode = $("#merge-mode").value;
      if (mode === "sheets") {
        const used = new Set();
        const sheets = tables.map((table, index) => {
          const base = sanitizeFileName(table.name.replace(/\.[^.]+$/, "")).slice(0, 27) || `表${index + 1}`;
          let name = base;
          let suffix = 2;
          while (used.has(name.toLocaleLowerCase("zh-CN"))) {
            const tail = `-${suffix++}`;
            name = `${base.slice(0, 27 - tail.length)}${tail}`;
          }
          used.add(name.toLocaleLowerCase("zh-CN"));
          return { name, rows: table.rows };
        });
        state.result = { blob: await workbookBlob(sheets), name: "多表合并结果.xlsx" };
        showResult(`<span>合并 <strong>${sheets.length}</strong> 个工作表</span>`, tables[0].rows);
      } else {
        const headers = [...new Set(tables.flatMap((table) => table.rows[0]))];
        const merged = [headers];
        tables.forEach((table) => table.rows.slice(1).forEach((row) => merged.push(headers.map((header) => row[table.rows[0].indexOf(header)] ?? ""))));
        state.result = { blob: await workbookBlob([{ name: "合并结果", rows: merged }]), name: "多表合并结果.xlsx" };
        showResult(`<span>合并 <strong>${tables.length}</strong> 个文件</span><span>共 <strong>${merged.length - 1}</strong> 行</span><span>统一为 <strong>${headers.length}</strong> 列</span>`, merged);
      }
      progress(100);
    } catch (error) { progress(0); status(error.message, "error"); }
  });
  $("#download").addEventListener("click", () => state.result && download(state.result.blob, state.result.name));
}

function initializeSplit() {
  bindSingleUpload((table) => { fillSelect($("#group-column"), table.rows[0]); tablePreview(table.rows); });
  bindEncodingReload([$("#files")]);
  $("#run").addEventListener("click", async () => {
    invalidateResult();
    try {
      const table = state.tables[0];
      if (!table) throw new Error("请先选择一个表格文件。");
      if (!window.JSZip) throw new Error("ZIP 组件未加载，请刷新页面重试。");
      const index = Number($("#group-column").value);
      const groups = new Map();
      table.rows.slice(1).forEach((row) => {
        const key = String(row[index] ?? "").trim() || "空值";
        if (!groups.has(key)) groups.set(key, [table.rows[0]]);
        groups.get(key).push(row);
      });
      if (groups.size > 500) throw new Error("分组超过 500 个，请先清理分组列或拆小文件。");
      const zip = new JSZip();
      const used = new Set();
      let done = 0;
      for (const [key, rows] of groups) {
        let name = sanitizeFileName(key);
        let suffix = 2;
        while (used.has(name.toLocaleLowerCase("zh-CN"))) name = `${sanitizeFileName(key).slice(0, 70)}-${suffix++}`;
        used.add(name.toLocaleLowerCase("zh-CN"));
        zip.file(`${name}.xlsx`, await workbookBlob([{ name: "数据", rows }]));
        done += 1;
        progress((done / groups.size) * 70);
      }
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, (meta) => progress(70 + meta.percent * .3));
      state.result = { blob, name: "按列拆分结果.zip" };
      const preview = [["分组值", "数据行数"], ...[...groups].map(([key, rows]) => [key, rows.length - 1])];
      showResult(`<span>生成 <strong>${groups.size}</strong> 个文件</span><span>共处理 <strong>${table.rows.length - 1}</strong> 行</span>`, preview);
    } catch (error) { progress(0); status(error.message, "error"); }
  });
  $("#download").addEventListener("click", () => state.result && download(state.result.blob, state.result.name));
}

function initializeCompare() {
  const inputs = [$("#left-file"), $("#right-file")];
  inputs.forEach((input, side) => input.addEventListener("change", async () => {
    try {
      invalidateResult();
      state.files[side] = undefined;
      state.tables[side] = undefined;
      const file = input.files[0];
      checkFile(file);
      state.files[side] = file;
      checkFileCollection(state.files.filter(Boolean));
      const warning = largeFileWarning([file]);
      status(warning || `正在读取${side === 0 ? "旧版" : "新版"}文件…`, warning ? "warning" : "");
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const table = await readFile(file, encoding());
      state.tables[side] = table;
      status(warning || `已读取${side === 0 ? "旧版" : "新版"}：${table.rows.length - 1} 行。`, warning ? "warning" : "");
      if (state.tables[0] && state.tables[1]) {
        const common = state.tables[0].rows[0].filter((header) => state.tables[1].rows[0].includes(header));
        const select = $("#key-column");
        select.innerHTML = common.map((header) => `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`).join("");
        if (!common.length) status("两个表没有同名列，无法选择匹配键。", "error");
      }
    } catch (error) {
      state.files[side] = undefined;
      state.tables[side] = undefined;
      status(error.message, "error");
    }
  }));
  bindEncodingReload(inputs);
  $("#run").addEventListener("click", async () => {
    invalidateResult();
    try {
      const [left, right] = state.tables;
      if (!left || !right) throw new Error("请分别选择旧版和新版文件。");
      const key = $("#key-column").value;
      if (!key) throw new Error("请选择两张表共有的关键列。");
      const result = compareRows(left.rows, right.rows, { left: [left.rows[0].indexOf(key)], right: [right.rows[0].indexOf(key)] }, { trim: $("#trim").checked, ignoreCase: $("#ignore-case").checked });
      const sheets = [
        { name: "新增", rows: [result.headers, ...result.added] },
        { name: "删除", rows: [result.headers, ...result.removed] },
        { name: "修改", rows: [[...result.headers, "变更列"], ...result.changed] },
        { name: "未变化", rows: [result.headers, ...result.unchanged] }
      ];
      state.result = { blob: await workbookBlob(sheets), name: "表格差异对比结果.xlsx" };
      showResult(`<span>新增 <strong>${result.added.length}</strong></span><span>删除 <strong>${result.removed.length}</strong></span><span>修改 <strong>${result.changed.length}</strong></span><span>未变化 <strong>${result.unchanged.length}</strong></span>`, [[...result.headers, "变更列"], ...result.changed]);
    } catch (error) { status(error.message, "error"); }
  });
  $("#download").addEventListener("click", () => state.result && download(state.result.blob, state.result.name));
}

document.addEventListener("change", (event) => {
  if (event.target.matches('select:not(#encoding), input[type="checkbox"]')) invalidateResult();
});

if (tool === "converter") initializeConverter();
if (tool === "dedupe") initializeDedupe();
if (tool === "merge") initializeMerge();
if (tool === "split") initializeSplit();
if (tool === "compare") initializeCompare();
