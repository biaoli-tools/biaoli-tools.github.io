function xmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
}

function columnName(index) {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

function columnIndex(reference) {
  const letters = (reference.match(/[A-Z]+/i) || ["A"])[0].toUpperCase();
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function resolveZipPath(base, target) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = `${base}/${target}`.split("/");
  const resolved = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return resolved.join("/");
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

function isDateFormat(formatId, formatCode = "") {
  if (BUILTIN_DATE_FORMATS.has(formatId)) return true;
  const visible = formatCode
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/_.|\*./g, "");
  return /[ymdhis]/i.test(visible);
}

export function formatExcelDate(serial, formatCode = "", date1904 = false) {
  const number = Number(serial);
  if (!Number.isFinite(number)) return String(serial ?? "");
  const unixEpochSerial = date1904 ? 24107 : 25569;
  const date = new Date(Math.round((number - unixEpochSerial) * 86400 * 1000));
  const iso = date.toISOString();
  const hasDate = /[yd]/i.test(formatCode) || number >= 1;
  const hasTime = /[his]/i.test(formatCode) || number % 1 !== 0;
  if (hasDate && hasTime) return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
  if (hasDate) return iso.slice(0, 10);
  return iso.slice(11, 19);
}

function readStyles(documentNode) {
  if (!documentNode) return [];
  const customFormats = new Map([...documentNode.getElementsByTagName("numFmt")].map((node) => [Number(node.getAttribute("numFmtId")), node.getAttribute("formatCode") || ""]));
  const cellXfs = documentNode.getElementsByTagName("cellXfs")[0];
  if (!cellXfs) return [];
  return [...cellXfs.childNodes]
    .filter((node) => node.nodeType === 1 && node.localName === "xf")
    .map((node) => {
      const id = Number(node.getAttribute("numFmtId") || 0);
      const code = customFormats.get(id) || "";
      return { id, code, isDate: isDateFormat(id, code) };
    });
}

export function formatCellValue({ formula, type, raw, style, date1904 = false }, shared = []) {
  if (formula != null) return `=${formula}`;
  if (type === "s") return shared[Number(raw)] ?? "";
  if (type === "b") return raw === "1" ? "TRUE" : "FALSE";
  if (style?.isDate && raw !== "") return formatExcelDate(raw, style.code, date1904);
  return raw;
}

function sheetXml(rows) {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndexValue) => {
      const reference = `${columnName(columnIndexValue)}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

export async function writeXlsx(sheets) {
  if (!window.JSZip) throw new Error("ZIP 组件未加载，请刷新页面重试。");
  const zip = new JSZip();
  const usedNames = new Set();
  const normalizedSheets = sheets.map((sheet, index) => {
    const source = String(sheet.name ?? "").replace(/[\\/*?:\[\]]/g, "_").replace(/^'+|'+$/g, "").trim() || `表${index + 1}`;
    let name = source.slice(0, 31);
    let suffix = 2;
    while (usedNames.has(name.toLocaleLowerCase("zh-CN"))) {
      const tail = `-${suffix++}`;
      name = `${source.slice(0, 31 - tail.length)}${tail}`;
    }
    usedNames.add(name.toLocaleLowerCase("zh-CN"));
    return { ...sheet, name };
  });
  const overrides = normalizedSheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${normalizedSheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${normalizedSheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}</Relationships>`);
  normalizedSheets.forEach((sheet, index) => zip.file(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet.rows)));
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

function parseXml(text, filename) {
  const documentNode = new DOMParser().parseFromString(text, "application/xml");
  if (documentNode.querySelector("parsererror")) throw new Error(`${filename} 内部 XML 无法解析。`);
  return documentNode;
}

export async function readXlsx(buffer, filename = "工作簿") {
  if (!window.JSZip) throw new Error("ZIP 组件未加载，请刷新页面重试。");
  let zip;
  try { zip = await JSZip.loadAsync(buffer); }
  catch { throw new Error(`${filename} 不是有效的 XLSX 文件，可能已损坏或加密。`); }
  const workbookEntry = zip.file("xl/workbook.xml");
  const relsEntry = zip.file("xl/_rels/workbook.xml.rels");
  if (!workbookEntry || !relsEntry) throw new Error(`${filename} 缺少工作簿结构。`);
  const workbookDoc = parseXml(await workbookEntry.async("text"), filename);
  const relsDoc = parseXml(await relsEntry.async("text"), filename);
  const relationMap = new Map([...relsDoc.getElementsByTagName("Relationship")].map((node) => [node.getAttribute("Id"), node.getAttribute("Target")]));
  const sharedEntry = zip.file("xl/sharedStrings.xml");
  const shared = sharedEntry ? [...parseXml(await sharedEntry.async("text"), filename).getElementsByTagName("si")].map((node) => node.textContent) : [];
  const stylesEntry = zip.file("xl/styles.xml");
  const styles = stylesEntry ? readStyles(parseXml(await stylesEntry.async("text"), filename)) : [];
  const workbookProperties = workbookDoc.getElementsByTagName("workbookPr")[0];
  const date1904 = ["1", "true"].includes((workbookProperties?.getAttribute("date1904") || "").toLowerCase());
  const sheetNodes = [...workbookDoc.getElementsByTagName("sheet")];
  if (!sheetNodes.length) throw new Error(`${filename} 不包含工作表。`);
  const worksheets = [];
  for (const sheetNode of sheetNodes) {
    const relationId = sheetNode.getAttribute("r:id") || sheetNode.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const target = relationMap.get(relationId);
    const normalizedTarget = resolveZipPath("xl", String(target || ""));
    const entry = zip.file(normalizedTarget);
    if (!entry) continue;
    const sheetDoc = parseXml(await entry.async("text"), filename);
    const rows = [];
    [...sheetDoc.getElementsByTagName("row")].forEach((rowNode) => {
      const row = [];
      [...rowNode.getElementsByTagName("c")].forEach((cellNode) => {
        const index = columnIndex(cellNode.getAttribute("r") || "A1");
        const type = cellNode.getAttribute("t");
        const style = styles[Number(cellNode.getAttribute("s") || 0)];
        const formula = cellNode.getElementsByTagName("f")[0]?.textContent;
        const raw = cellNode.getElementsByTagName("v")[0]?.textContent ?? cellNode.getElementsByTagName("is")[0]?.textContent ?? "";
        row[index] = formatCellValue({ formula, type, raw, style, date1904 }, shared);
      });
      const rowNumber = Math.max(1, Number(rowNode.getAttribute("r") || rows.length + 1));
      while (rows.length < rowNumber - 1) rows.push([]);
      rows[rowNumber - 1] = row.map((value) => value ?? "");
    });
    worksheets.push({ name: sheetNode.getAttribute("name") || "数据", rows });
  }
  if (!worksheets.length) throw new Error(`${filename} 的工作表无法读取。`);
  return { sheetName: worksheets[0].name, rows: worksheets[0].rows, worksheets };
}
