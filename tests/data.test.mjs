import test from "node:test";
import assert from "node:assert/strict";
import { compareRows, deduplicateRows, detectDelimiter, largeFileWarning, parseDelimited, protectSpreadsheetFormula, sanitizeFileName, toDelimited } from "../src/js/data.js";

test("quoted CSV round-trips", () => {
  const rows = [["姓名", "备注"], ["小林", "含,逗号"], ["小周", "两\n行"]];
  assert.deepEqual(parseDelimited(toDelimited(rows), ","), rows);
});

test("delimiter detection recognizes tabs", () => {
  assert.equal(detectDelimiter("a\tb\n1\t2"), "\t");
});

test("delimiter detection ignores separators inside quoted fields", () => {
  assert.equal(detectDelimiter('编号;备注\n1;"包含,逗号"'), ";");
});

test("invalid CSV reports an unclosed quote", () => {
  assert.throws(() => parseDelimited('编号,备注\n1,"未闭合', ","), /未闭合/);
});

test("dedupe supports trim, case folding and keep-last", () => {
  const rows = [["编号", "姓名"], [" A1 ", "甲"], ["a1", "乙"]];
  const result = deduplicateRows(rows, [0], { trim: true, ignoreCase: true, keep: "last" });
  assert.equal(result.kept[1][1], "乙");
  assert.equal(result.duplicates.length, 2);
});

test("compare separates added, removed, changed and unchanged", () => {
  const left = [["ID", "值"], ["1", "A"], ["2", "B"], ["3", "C"]];
  const right = [["ID", "值"], ["1", "A"], ["2", "X"], ["4", "D"]];
  const result = compareRows(left, right, { left: [0], right: [0] });
  assert.equal(result.added.length, 1);
  assert.equal(result.removed.length, 1);
  assert.equal(result.changed.length, 1);
  assert.equal(result.unchanged.length, 1);
});

test("filename sanitizer removes reserved characters", () => {
  assert.equal(sanitizeFileName(' 销售/华东:*? '), "销售_华东___");
});

test("CSV export protects formula-like cells by default", () => {
  assert.equal(protectSpreadsheetFormula("=2+2"), "'=2+2");
  assert.equal(toDelimited([["内容"], ["@SUM(A1:A2)"]]), "内容\r\n'@SUM(A1:A2)");
  assert.equal(toDelimited([["=2+2"]], ",", { protectFormulas: false }), "=2+2");
});

test("large files receive a visible warning", () => {
  assert.match(largeFileWarning([{ name: "月报.xlsx", size: 21 * 1024 * 1024 }]), /月报\.xlsx超过 20 MB/);
  assert.equal(largeFileWarning([{ name: "小表.csv", size: 1024 }]), "");
});
