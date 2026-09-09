export const LIMITS = {
  maxFileBytes: 50 * 1024 * 1024,
  maxTotalFileBytes: 200 * 1024 * 1024,
  maxFiles: 50,
  warnFileBytes: 20 * 1024 * 1024,
  previewRows: 12,
  previewColumns: 12
};

export function largeFileWarning(files) {
  const large = files.filter((file) => file.size > LIMITS.warnFileBytes);
  if (!large.length) return "";
  return `${large.length === 1 ? large[0].name : `${large.length} 个文件`}超过 20 MB，处理时页面可能短暂无响应。建议先关闭其他占用内存的页面。`;
}

export function normalizeCell(value, { trim = false, ignoreCase = false } = {}) {
  let result = value == null ? "" : String(value);
  if (trim) result = result.trim();
  if (ignoreCase) result = result.toLocaleLowerCase("zh-CN");
  return result;
}

export function makeKey(row, indexes, options = {}) {
  return JSON.stringify(indexes.map((index) => normalizeCell(row[index], options)));
}

export function deduplicateRows(rows, indexes, options = {}) {
  if (!rows.length) return { kept: [], duplicates: [] };
  const header = rows[0];
  const body = rows.slice(1);
  const selected = indexes.length ? indexes : header.map((_, index) => index);
  const occurrences = new Map();
  body.forEach((row, index) => {
    const key = makeKey(row, selected, options);
    if (!occurrences.has(key)) occurrences.set(key, []);
    occurrences.get(key).push(index);
  });
  const keepLast = options.keep === "last";
  const kept = [header];
  const duplicates = [[...header, "重复原因"]];
  body.forEach((row, index) => {
    const positions = occurrences.get(makeKey(row, selected, options));
    const keeper = keepLast ? positions.at(-1) : positions[0];
    if (index === keeper) kept.push(row);
    else duplicates.push([...row, `与数据行 ${keeper + 2} 重复`]);
  });
  return { kept, duplicates };
}

export function compareRows(leftRows, rightRows, keyIndexes, options = {}) {
  const leftHeader = leftRows[0] || [];
  const rightHeader = rightRows[0] || [];
  const headers = [...new Set([...leftHeader, ...rightHeader])];
  const align = (row, sourceHeader) => headers.map((name) => row[sourceHeader.indexOf(name)] ?? "");
  const duplicateSummary = (rows, indexes, label) => {
    const positions = new Map();
    rows.slice(1).forEach((row, index) => {
      const key = makeKey(row, indexes, options);
      if (!positions.has(key)) positions.set(key, []);
      positions.get(key).push(index + 2);
    });
    const duplicates = [...positions.values()].filter((items) => items.length > 1);
    if (!duplicates.length) return "";
    const examples = duplicates.slice(0, 3).map((items) => items.join("、")).join("；");
    return `${label}关键列存在 ${duplicates.length} 组重复值（数据行 ${examples}），请先去重后再比较。`;
  };
  const duplicateError = duplicateSummary(leftRows, keyIndexes.left, "旧版") || duplicateSummary(rightRows, keyIndexes.right, "新版");
  if (duplicateError) throw new Error(duplicateError);
  const leftMap = new Map(leftRows.slice(1).map((row) => [makeKey(row, keyIndexes.left, options), align(row, leftHeader)]));
  const rightMap = new Map(rightRows.slice(1).map((row) => [makeKey(row, keyIndexes.right, options), align(row, rightHeader)]));
  const keys = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const result = { headers, added: [], removed: [], changed: [], unchanged: [] };
  keys.forEach((key) => {
    const before = leftMap.get(key);
    const after = rightMap.get(key);
    if (!before) result.added.push(after);
    else if (!after) result.removed.push(before);
    else {
      const changedColumns = headers.filter((_, index) => normalizeCell(before[index], options) !== normalizeCell(after[index], options));
      if (changedColumns.length) result.changed.push([...after, changedColumns.join("、")]);
      else result.unchanged.push(after);
    }
  });
  return result;
}

export function sanitizeFileName(value, fallback = "未命名") {
  let clean = String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|\[\]\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 80);
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(clean)) clean = `_${clean}`;
  return clean || fallback;
}

function sampleCompleteRecords(text, limit = 5) {
  let quoted = false;
  let records = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (char === "\n" && !quoted) {
      records += 1;
      if (records >= limit) return text.slice(0, index + 1);
    }
  }
  return text;
}

export function detectDelimiter(text) {
  const sample = sampleCompleteRecords(text);
  const candidates = [",", "\t", ";", "|"];
  return candidates
    .map((delimiter) => {
      const widths = parseDelimited(sample, delimiter).map((row) => row.length);
      const frequencies = new Map();
      widths.forEach((width) => frequencies.set(width, (frequencies.get(width) || 0) + 1));
      const [commonWidth = 0, consistentRows = 0] = [...frequencies].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] || [];
      return { delimiter, score: commonWidth > 1 ? consistentRows * commonWidth : 0 };
    })
    .sort((a, b) => b.score - a.score)[0].delimiter;
}

export function parseDelimited(text, delimiter = detectDelimiter(text)) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (quoted) throw new Error("CSV 中有未闭合的英文引号，请检查文件内容。");
  return rows.filter((item, index) => index === 0 || item.some((cell) => cell !== ""));
}

export function protectSpreadsheetFormula(value) {
  const text = value == null ? "" : String(value);
  return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function toDelimited(rows, delimiter = ",", { protectFormulas = true } = {}) {
  return rows.map((row) => row.map((value) => {
    const text = protectFormulas ? protectSpreadsheetFormula(value) : (value == null ? "" : String(value));
    return /["\r\n,;\t|]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(delimiter)).join("\r\n");
}
