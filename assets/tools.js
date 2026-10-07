import { LIMITS, compareColumns, compareRows, deduplicateRows, largeFileWarning, parseDelimited, sanitizeFileName, toDelimited } from "./data.js?v=1.19.1";
import { readXlsx, writeXlsx } from "./xlsx-lite.js?v=1.19.1";

const tool = document.body.dataset.tool;
const state = { files: [], tables: [], result: null, running: false };
const readVersions = new WeakMap();
const lockedControls = new WeakMap();
let jsZipPromise = null;

function loadJsZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (jsZipPromise) return jsZipPromise;
  jsZipPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const finish = (handler) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      handler();
    };
    const timeout = setTimeout(() => finish(() => {
      script.remove();
      reject(new Error("ZIP 组件加载超时，请刷新页面重试。"));
    }), 10000);
    script.src = "/assets/vendor/jszip.min.js?v=1.19.1";
    script.async = true;
    script.onload = () => finish(() => window.JSZip ? resolve(window.JSZip) : reject(new Error("ZIP 组件加载失败，请刷新页面重试。")));
    script.onerror = () => finish(() => {
      script.remove();
      reject(new Error("ZIP 组件加载失败，请检查页面资源后重试。"));
    });
    document.head.appendChild(script);
  }).catch((error) => {
    jsZipPromise = null;
    throw error;
  });
  return jsZipPromise;
}
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function status(message, type = "") {
  const node = $("#status");
  if (!node) return;
  node.textContent = message;
  node.className = `status show ${type}`;
  node.setAttribute("role", type === "error" ? "alert" : "status");
  node.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
}

function clearStatus() {
  const node = $("#status");
  if (!node) return;
  node.textContent = "";
  node.className = "status";
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
}

function canRun() {
  if (tool === "converter" || tool === "encodingFix" || tool === "split") return Boolean(state.tables[0]);
  if (tool === "dedupe") {
    const keep = $("#keep")?.value;
    const dateReady = keep !== "latest" && keep !== "earliest" || $("#date-column")?.value !== undefined && $("#date-column")?.value !== "";
    return Boolean(state.tables[0]) && selectedIndexes($("#columns")).length > 0 && dateReady;
  }
  if (tool === "columnCompare") return Boolean(state.tables[0]) && $("#left-column")?.value !== $("#right-column")?.value;
  if (tool === "merge") return state.files.length >= 2;
  if (tool === "compare") return Boolean(state.tables[0] && state.tables[1] && $("#key-column")?.value);
  return false;
}

function beginRead(input) {
  const version = (readVersions.get(input) || 0) + 1;
  readVersions.set(input, version);
  return version;
}

function isCurrentRead(input, version) {
  return readVersions.get(input) === version;
}

function setControlsLocked(locked) {
  const controls = $$('.workbench input, .workbench select, .workbench button:not(#run):not(#download)');
  for (const control of controls) {
    if (locked) {
      lockedControls.set(control, control.disabled);
      control.disabled = true;
    } else if (lockedControls.has(control)) {
      control.disabled = lockedControls.get(control);
      lockedControls.delete(control);
    }
  }
}

function refreshRunReady() {
  const button = $("#run");
  if (!button || state.running) return;
  button.disabled = !canRun();
}

function progress(value) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  const node = $("#progress");
  const bar = $("#progress span");
  if (node) node.setAttribute("aria-valuenow", String(Math.round(safeValue)));
  if (bar) bar.style.width = `${safeValue}%`;
}

function beginRun() {
  const button = $("#run");
  if (!button || button.disabled || state.running) return false;
  state.running = true;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.dataset.label = button.textContent;
  button.textContent = "处理中…";
  setControlsLocked(true);
  return true;
}

function endRun() {
  const button = $("#run");
  state.running = false;
  setControlsLocked(false);
  if (!button) return;
  button.removeAttribute("aria-busy");
  button.textContent = button.dataset.label || "处理并生成预览";
  delete button.dataset.label;
  refreshRunReady();
}

function invalidateResult() {
  state.result = null;
  if ($("#download")) {
    $("#download").disabled = true;
    $("#download").textContent = "下载处理结果";
  }
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
  await loadJsZip();
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
  target.innerHTML = `<table><thead><tr>${header.map((cell) => `<th scope="col">${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${data.map((row) => `<tr>${header.map((_, i) => `<td title="${escapeHtml(row[i] ?? "")}">${escapeHtml(row[i] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function fillSelect(node, headers, multiple = false) {
  node.innerHTML = headers.map((name, index) => `<option value="${index}"${multiple && index === 0 ? " selected" : ""}>${escapeHtml(name || `第 ${index + 1} 列`)}</option>`).join("");
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  return `${(value / 1024 ** 2).toFixed(value < 10 * 1024 ** 2 ? 1 : 0)} MB`;
}

function resultDownloadLabel() {
  if (!state.result) return "下载处理结果";
  const size = state.result.blob?.size;
  return size ? `下载 ${state.result.name}（${formatBytes(size)}）` : `下载 ${state.result.name}`;
}

function showResult(summary, rows, previewLabel = "处理结果") {
  $("#summary").innerHTML = summary;
  tablePreview(rows);
  if ($("#preview-label")) $("#preview-label").textContent = `当前预览：${previewLabel}`;
  const result = $("#result");
  result.classList.add("show");
  if ($("#download")) {
    $("#download").disabled = false;
    $("#download").textContent = resultDownloadLabel();
  }
  status("处理完成。请检查预览，确认无误后下载完整结果。");
  result.focus({ preventScroll: true });
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  result.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  endRun();
}

async function workbookBlob(sheets) {
  await loadJsZip();
  return writeXlsx(sheets);
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  status(`已开始下载 ${name}（${formatBytes(blob.size)}）。如果浏览器没有保存提示，请检查下载权限。`);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function bindSingleUpload(onReady, { filePattern = null, fileTypeMessage = "" } = {}) {
  const input = $("#files");
  input.addEventListener("change", async () => {
    const readVersion = beginRead(input);
    clearStatus();
    invalidateResult();
    state.files = [];
    state.tables = [];
    refreshRunReady();
    try {
      const file = input.files[0];
      checkFile(file);
      if (filePattern && !filePattern.test(file.name)) throw new Error(fileTypeMessage || "当前工具不支持这个文件格式。");
      const warning = largeFileWarning([file]);
      status(warning || `正在读取 ${file.name}…`, warning ? "warning" : "");
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (!isCurrentRead(input, readVersion)) return;
      progress(30);
      const table = await readFile(file, encoding());
      if (!isCurrentRead(input, readVersion)) return;
      state.files = [file];
      state.tables = [table];
      progress(0);
      const readSummary = `已读取 ${file.name}：${Math.max(0, table.rows.length - 1)} 行，${table.rows[0].length} 列。`;
      status(warning ? `${readSummary} ${warning}` : readSummary, warning ? "warning" : "");
      onReady?.(table);
      refreshRunReady();
    } catch (error) {
      if (!isCurrentRead(input, readVersion)) return;
      progress(0);
      refreshRunReady();
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
    if (!beginRun()) return;
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
      showResult(`<span><strong>${source.rows.length - 1}</strong> 行数据</span><span>输出：<strong>${format.toUpperCase()}</strong></span>`, source.rows, "转换后的数据");
    } catch (error) { endRun(); status(error.message, "error"); }
  });
  $("#download").addEventListener("click", () => state.result && download(state.result.blob, state.result.name));
}

function initializeEncodingFix() {
  bindSingleUpload((table) => tablePreview(table.rows), { filePattern: /\.(csv|tsv)$/i, fileTypeMessage: "乱码修复只支持 CSV 和 TSV 文件。" });
  bindEncodingReload([$("#files")]);
  $("#run").addEventListener("click", async () => {
    if (!beginRun()) return;
    invalidateResult();
    try {
      const source = state.tables[0];
      if (!source) throw new Error("请先选择一个 CSV 或 TSV 文件。");
      if (!/\.(csv|tsv)$/i.test(source.name)) throw new Error("乱码修复只支持 CSV 和 TSV 文件。");
      const requested = $("#encoding-output").value;
      const format = requested === "same" ? (/\.tsv$/i.test(source.name) ? "tsv" : "csv") : requested;
      const delimiter = format === "tsv" ? "\t" : ",";
      const text = toDelimited(source.rows, delimiter, { protectFormulas: $("#protect-formulas").checked });
      const prefix = $("#utf8-bom").checked ? "\ufeff" : "";
      const base = sanitizeFileName(source.name.replace(/\.[^.]+$/, ""));
      state.result = { blob: new Blob([`${prefix}${text}`], { type: "text/plain;charset=utf-8" }), name: `${base}-UTF8.${format}` };
      progress(100);
      showResult(`<span><strong>${source.rows.length - 1}</strong> 行数据</span><span>已按 <strong>${encoding().toUpperCase()}</strong> 读取</span><span>输出：<strong>UTF-8 ${format.toUpperCase()}</strong></span>`, source.rows, "UTF-8 数据");
    } catch (error) { endRun(); status(error.message, "error"); }
  });
  $("#download").addEventListener("click", () => state.result && download(state.result.blob, state.result.name));
}

function initializeDedupe() {
  const updateDateMode = () => {
    const keep = $("#keep").value;
    const usesDate = keep === "latest" || keep === "earliest";
    const field = $("#date-column-field");
    const select = $("#date-column");
    field.hidden = !usesDate;
    select.disabled = !usesDate;
    invalidateResult();
    refreshRunReady();
  };
  bindSingleUpload((table) => {
    fillColumnChecks($("#columns"), table.rows[0]);
    fillSelect($("#date-column"), table.rows[0]);
    tablePreview(table.rows);
    updateDateMode();
  });
  bindEncodingReload([$("#files")]);
  $("#keep").addEventListener("change", updateDateMode);
  $("#run").addEventListener("click", async () => {
    if (!beginRun()) return;
    invalidateResult();
    try {
      const table = state.tables[0];
      if (!table) throw new Error("请先选择一个表格文件。");
      const indexes = selectedIndexes($("#columns"));
      if (!indexes.length) throw new Error("至少选择一列作为去重依据。");
      const keep = $("#keep").value;
      const options = { keep, trim: $("#trim").checked, ignoreCase: $("#ignore-case").checked };
      if (keep === "latest" || keep === "earliest") options.dateIndex = Number($("#date-column").value);
      const result = deduplicateRows(table.rows, indexes, options);
      state.result = { blob: await workbookBlob([{ name: "去重结果", rows: result.kept }, { name: "重复行", rows: result.duplicates }]), name: "表格去重结果.xlsx" };
      const keepLabel = keep === "latest" ? `按“${table.rows[0][options.dateIndex]}”保留最新` : keep === "earliest" ? `按“${table.rows[0][options.dateIndex]}”保留最早` : keep === "last" ? "保留最后一条" : "保留第一条";
      showResult(`<span>保留 <strong>${result.kept.length - 1}</strong> 行</span><span>发现重复 <strong>${result.duplicates.length - 1}</strong> 行</span><span>${escapeHtml(keepLabel)}</span>`, result.kept, "去重结果");
    } catch (error) { endRun(); status(error.message, "error"); }
  });
  $("#download").addEventListener("click", () => state.result && download(state.result.blob, state.result.name));
}

function syncMergeInputFiles() {
  const input = $("#files");
  if (!input || typeof DataTransfer === "undefined") return;
  try {
    const transfer = new DataTransfer();
    state.files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
  } catch {
    // The internal file list remains authoritative if a browser blocks FileList assignment.
  }
}

function renderFileList() {
  const list = $("#file-list");
  if (!list) return;
  list.innerHTML = state.files.map((file, index) => {
    const safeName = escapeHtml(file.name);
    const upDisabled = index === 0 ? " disabled aria-disabled=\"true\"" : "";
    const downDisabled = index === state.files.length - 1 ? " disabled aria-disabled=\"true\"" : "";
    return `<div class="file-item"><span>${safeName} · ${formatBytes(file.size)}</span><span class="file-actions"><button type="button" class="icon-button" data-up="${index}" aria-label="上移 ${safeName}" title="上移"${upDisabled}>↑</button><button type="button" class="icon-button" data-down="${index}" aria-label="下移 ${safeName}" title="下移"${downDisabled}>↓</button><button type="button" class="icon-button" data-remove="${index}" aria-label="移除 ${safeName}" title="移除">×</button></span></div>`;
  }).join("");
  $$('[data-up]').forEach((button) => button.addEventListener("click", () => moveFile(Number(button.dataset.up), -1)));
  $$('[data-down]').forEach((button) => button.addEventListener("click", () => moveFile(Number(button.dataset.down), 1)));
  $$('[data-remove]').forEach((button) => button.addEventListener("click", () => {
    state.files.splice(Number(button.dataset.remove), 1);
    syncMergeInputFiles();
    invalidateResult();
    renderFileList();
    refreshRunReady();
    status(`当前保留 ${state.files.length} 个文件，请重新处理。`);
  }));
}

function moveFile(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= state.files.length) return;
  [state.files[index], state.files[target]] = [state.files[target], state.files[index]];
  syncMergeInputFiles();
  invalidateResult();
  renderFileList();
  refreshRunReady();
  status("文件顺序已调整，请重新处理。");
}

function initializeColumnCompare() {
  bindSingleUpload((table) => {
    fillSelect($("#left-column"), table.rows[0]);
    fillSelect($("#right-column"), table.rows[0]);
    if (table.rows[0].length > 1) $("#right-column").value = "1";
    tablePreview(table.rows);
    refreshRunReady();
  });
  bindEncodingReload([$("#files")]);
  $("#run").addEventListener("click", async () => {
    if (!beginRun()) return;
    invalidateResult();
    try {
      const table = state.tables[0];
      if (!table) throw new Error("请先选择一个表格文件。");
      const leftIndex = Number($("#left-column").value);
      const rightIndex = Number($("#right-column").value);
      if (leftIndex === rightIndex) throw new Error("请选择两列不同的字段进行比较。");
      const result = compareColumns(table.rows, leftIndex, rightIndex, { trim: $("#trim").checked, ignoreCase: $("#ignore-case").checked, ignoreEmpty: $("#ignore-empty").checked });
      const sheets = [
        { name: "共有值", rows: result.common },
        { name: "仅第一列", rows: result.onlyLeft },
        { name: "仅第二列", rows: result.onlyRight }
      ];
      state.result = { blob: await workbookBlob(sheets), name: "两列对比结果.xlsx" };
      const previewSet = result.common.length > 1 ? { rows: result.common, label: "共有值" } : result.onlyLeft.length > 1 ? { rows: result.onlyLeft, label: "仅第一列" } : result.onlyRight.length > 1 ? { rows: result.onlyRight, label: "仅第二列" } : { rows: result.common, label: "共有值" };
      showResult(`<span>共有 <strong>${result.common.length - 1}</strong> 个唯一值</span><span>仅第一列 <strong>${result.onlyLeft.length - 1}</strong></span><span>仅第二列 <strong>${result.onlyRight.length - 1}</strong></span>`, previewSet.rows, previewSet.label);
    } catch (error) { endRun(); status(error.message, "error"); }
  });
  $("#download").addEventListener("click", () => state.result && download(state.result.blob, state.result.name));
}

function initializeMerge() {
  $("#files").addEventListener("change", () => {
    try {
      invalidateResult();
      state.files = [...$("#files").files];
      state.files.forEach(checkFile);
      checkFileCollection(state.files);
      renderFileList();
      refreshRunReady();
      const warning = largeFileWarning(state.files);
      const selectionSummary = state.files.length < 2 ? `已选择 ${state.files.length} 个文件，还需至少选择 1 个文件才能合并。` : `已选择 ${state.files.length} 个文件，可调整合并顺序。`;
      status(warning ? `${selectionSummary} ${warning}` : selectionSummary, warning ? "warning" : "");
    } catch (error) {
      state.files = [];
      $("#files").value = "";
      renderFileList();
      refreshRunReady();
      status(error.message, "error");
    }
  });
  bindEncodingReload([$("#files")], { reload: false });
  $("#run").addEventListener("click", async () => {
    if (!beginRun()) return;
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
        showResult(`<span>合并 <strong>${sheets.length}</strong> 个工作表</span>`, tables[0].rows, `第一个工作表：${tables[0].name}`);
      } else {
        const headers = [...new Set(tables.flatMap((table) => table.rows[0]))];
        const merged = [headers];
        tables.forEach((table) => table.rows.slice(1).forEach((row) => merged.push(headers.map((header) => row[table.rows[0].indexOf(header)] ?? ""))));
        state.result = { blob: await workbookBlob([{ name: "合并结果", rows: merged }]), name: "多表合并结果.xlsx" };
        showResult(`<span>合并 <strong>${tables.length}</strong> 个文件</span><span>共 <strong>${merged.length - 1}</strong> 行</span><span>统一为 <strong>${headers.length}</strong> 列</span>`, merged, "合并结果");
      }
      progress(100);
    } catch (error) { progress(0); endRun(); status(error.message, "error"); }
  });
  $("#download").addEventListener("click", () => state.result && download(state.result.blob, state.result.name));
}

function initializeSplit() {
  bindSingleUpload((table) => { fillSelect($("#group-column"), table.rows[0]); tablePreview(table.rows); });
  bindEncodingReload([$("#files")]);
  $("#run").addEventListener("click", async () => {
    if (!beginRun()) return;
    invalidateResult();
    try {
      const table = state.tables[0];
      if (!table) throw new Error("请先选择一个表格文件。");
      const JSZipCtor = await loadJsZip();
      const index = Number($("#group-column").value);
      const groups = new Map();
      table.rows.slice(1).forEach((row) => {
        const key = String(row[index] ?? "").trim() || "空值";
        if (!groups.has(key)) groups.set(key, [table.rows[0]]);
        groups.get(key).push(row);
      });
      if (groups.size > 500) throw new Error("分组超过 500 个，请先清理分组列或拆小文件。");
      const zip = new JSZipCtor();
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
      showResult(`<span>生成 <strong>${groups.size}</strong> 个文件</span><span>共处理 <strong>${table.rows.length - 1}</strong> 行</span>`, preview, "分组统计");
    } catch (error) { progress(0); endRun(); status(error.message, "error"); }
  });
  $("#download").addEventListener("click", () => state.result && download(state.result.blob, state.result.name));
}

function initializeCompare() {
  const inputs = [$("#left-file"), $("#right-file")];
  inputs.forEach((input, side) => input.addEventListener("change", async () => {
    const readVersion = beginRead(input);
    try {
      invalidateResult();
      state.files[side] = undefined;
      state.tables[side] = undefined;
      refreshRunReady();
      const file = input.files[0];
      checkFile(file);
      state.files[side] = file;
      checkFileCollection(state.files.filter(Boolean));
      const warning = largeFileWarning([file]);
      status(warning || `正在读取${side === 0 ? "旧版" : "新版"}文件…`, warning ? "warning" : "");
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (!isCurrentRead(input, readVersion)) return;
      const table = await readFile(file, encoding());
      if (!isCurrentRead(input, readVersion)) return;
      state.tables[side] = table;
      status(warning || `已读取${side === 0 ? "旧版" : "新版"}：${table.rows.length - 1} 行。`, warning ? "warning" : "");
      if (state.tables[0] && state.tables[1]) {
        const common = state.tables[0].rows[0].filter((header) => state.tables[1].rows[0].includes(header));
        const select = $("#key-column");
        select.innerHTML = common.map((header) => `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`).join("");
        if (!common.length) status("两个表没有同名列，无法选择匹配键。", "error");
      }
      refreshRunReady();
    } catch (error) {
      if (!isCurrentRead(input, readVersion)) return;
      state.files[side] = undefined;
      state.tables[side] = undefined;
      refreshRunReady();
      status(error.message, "error");
    }
  }));
  bindEncodingReload(inputs);
  $("#run").addEventListener("click", async () => {
    if (!beginRun()) return;
    invalidateResult();
    try {
      const [left, right] = state.tables;
      if (!left || !right) throw new Error("请分别选择旧版和新版文件。");
      const key = $("#key-column").value;
      if (!key) throw new Error("请选择两张表共有的关键列。");
      const result = compareRows(left.rows, right.rows, { left: [left.rows[0].indexOf(key)], right: [right.rows[0].indexOf(key)] }, { trim: $("#trim").checked, ignoreCase: $("#ignore-case").checked });
      const changeDetailRows = [["关键值", "字段", "旧值", "新值"], ...result.changeDetails];
      const sheets = [
        { name: "新增", rows: [result.headers, ...result.added] },
        { name: "删除", rows: [result.headers, ...result.removed] },
        { name: "修改", rows: [[...result.headers, "变更列"], ...result.changed] },
        { name: "字段差异", rows: changeDetailRows },
        { name: "未变化", rows: [result.headers, ...result.unchanged] }
      ];
      state.result = { blob: await workbookBlob(sheets), name: "表格差异对比结果.xlsx" };
      let previewRows = changeDetailRows;
      let previewLabel = "字段差异";
      if (!result.changeDetails.length && result.changed.length) {
        previewRows = [[...result.headers, "变更列"], ...result.changed];
        previewLabel = "修改记录";
      } else if (!result.changeDetails.length && !result.changed.length && result.added.length) {
        previewRows = [result.headers, ...result.added];
        previewLabel = "新增记录";
      } else if (!result.changeDetails.length && !result.changed.length && !result.added.length && result.removed.length) {
        previewRows = [result.headers, ...result.removed];
        previewLabel = "删除记录";
      } else if (!result.changeDetails.length && !result.changed.length && !result.added.length && !result.removed.length) {
        previewRows = [result.headers, ...result.unchanged];
        previewLabel = "未变化记录";
      }
      showResult(`<span>新增 <strong>${result.added.length}</strong></span><span>删除 <strong>${result.removed.length}</strong></span><span>修改记录 <strong>${result.changed.length}</strong></span><span>字段变化 <strong>${result.changeDetails.length}</strong> 处</span><span>未变化 <strong>${result.unchanged.length}</strong></span>`, previewRows, previewLabel);
    } catch (error) { endRun(); status(error.message, "error"); }
  });
  $("#download").addEventListener("click", () => state.result && download(state.result.blob, state.result.name));
}

function resetWorkbench() {
  if (state.running) return;
  for (const input of $$('.workbench input[type="file"]')) {
    beginRead(input);
    input.value = "";
  }
  state.files = [];
  state.tables = [];
  invalidateResult();
  clearStatus();
  if ($("#file-list")) $("#file-list").textContent = "";
  if ($("#columns")) $("#columns").textContent = "";
  if ($("#date-column")) $("#date-column").innerHTML = "<option>读取文件后显示列</option>";
  if ($("#date-column-field")) $("#date-column-field").hidden = true;
  if ($("#group-column")) $("#group-column").innerHTML = "<option>读取文件后显示列</option>";
  if ($("#left-column")) $("#left-column").innerHTML = "<option>读取文件后显示列</option>";
  if ($("#right-column")) $("#right-column").innerHTML = "<option>读取文件后显示列</option>";
  if ($("#key-column")) $("#key-column").innerHTML = "<option>读取两个文件后显示共有列</option>";
  refreshRunReady();
  status("已清空当前文件和结果，可以选择另一份文件继续处理。");
}

document.addEventListener("change", (event) => {
  if (!event.target.matches('select:not(#encoding), input[type="checkbox"]')) return;
  invalidateResult();
  refreshRunReady();
});

$("#reset-tool")?.addEventListener("click", resetWorkbench);

window.addEventListener("beforeunload", (event) => {
  if (!state.running) return;
  event.preventDefault();
  event.returnValue = "";
});

if (tool === "converter") initializeConverter();
if (tool === "encodingFix") initializeEncodingFix();
if (tool === "dedupe") initializeDedupe();
if (tool === "columnCompare") initializeColumnCompare();
if (tool === "merge") initializeMerge();
if (tool === "split") initializeSplit();
if (tool === "compare") initializeCompare();

refreshRunReady();
