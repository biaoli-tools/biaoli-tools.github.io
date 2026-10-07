import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = { console, setTimeout, clearTimeout, setImmediate, clearImmediate, Blob, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, Promise };
vm.createContext(context);
vm.runInContext(readFileSync(new URL("../src/vendor/jszip.min.js", import.meta.url), "utf8"), context);
const { JSZip } = context;
globalThis.window = globalThis;
globalThis.JSZip = JSZip;
const { MAX_XLSX_EXPANDED_BYTES, MAX_XLSX_ROWS, MAX_XLSX_COLUMNS, expandedZipBytes, formatCellValue, formatExcelDate, writeXlsx } = await import("../src/js/xlsx-lite.js");

test("xlsx writer creates a valid Open XML package", async () => {
  const blob = await writeXlsx([{ name: "数据", rows: [["编号", "名称"], ["001", "项目甲"]] }]);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  for (const name of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/worksheets/sheet1.xml"]) {
    assert.ok(zip.file(name), `missing ${name}`);
  }
  const sheet = await zip.file("xl/worksheets/sheet1.xml").async("text");
  assert.match(sheet, /001/);
  assert.match(sheet, /项目甲/);
});

test("xlsx writer cleans and deduplicates worksheet names", async () => {
  const blob = await writeXlsx([
    { name: "[华东]", rows: [["值"], ["1"]] },
    { name: "[华东]", rows: [["值"], ["2"]] }
  ]);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const workbook = await zip.file("xl/workbook.xml").async("text");
  assert.match(workbook, /name="_华东_"/);
  assert.match(workbook, /name="_华东_-2"/);
  assert.doesNotMatch(workbook, /name="\[华东\]"/);
});

test("xlsx values normalize dates and preserve formulas as text", () => {
  assert.equal(formatExcelDate("46274", "yyyy-mm-dd"), "2026-09-09");
  assert.equal(formatExcelDate("0", "yyyy-mm-dd", true), "1904-01-01");
  assert.equal(formatCellValue({ formula: "C2*2", type: "n", raw: "25", style: null }), "=C2*2");
  assert.equal(formatCellValue({ type: "b", raw: "1", style: null }), "TRUE");
});


test("xlsx expansion estimator ignores directories and sums uncompressed payload", () => {
  const mock = { files: {
    "xl/": { dir: true, _data: { uncompressedSize: 999 } },
    "xl/workbook.xml": { dir: false, _data: { uncompressedSize: 1200 } },
    "xl/worksheets/sheet1.xml": { dir: false, _data: { uncompressedSize: 3400 } }
  } };
  assert.equal(expandedZipBytes(mock), 4600);
  assert.equal(MAX_XLSX_EXPANDED_BYTES, 300 * 1024 * 1024);
});

test("xlsx writer rejects sheets beyond Excel row and column limits", async () => {
  const tooManyRows = [];
  tooManyRows.length = MAX_XLSX_ROWS + 1;
  await assert.rejects(() => writeXlsx([{ name: "超长", rows: tooManyRows }]), /超过 Excel 单工作表最多 1,048,576 行/);

  const tooWideRow = [];
  tooWideRow.length = MAX_XLSX_COLUMNS + 1;
  await assert.rejects(() => writeXlsx([{ name: "超宽", rows: [tooWideRow] }]), /超过 Excel 单工作表最多 16,384 列/);
});
