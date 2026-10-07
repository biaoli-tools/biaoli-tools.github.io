import test from "node:test";
import assert from "node:assert/strict";
import { compareColumns, compareRows, deduplicateRows, detectDelimiter, largeFileWarning, parseDelimited, protectSpreadsheetFormula, sanitizeFileName, toDelimited } from "../src/js/data.js";

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

test("delimiter detection keeps complete multiline records", () => {
  const text = '编号,备注\n1,"第一行\n第二行\n第三行\n第四行\n第五行"\n2,完成';
  assert.equal(detectDelimiter(text), ",");
  assert.equal(parseDelimited(text)[1][1], "第一行\n第二行\n第三行\n第四行\n第五行");
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


test("dedupe can keep latest or earliest by an explicit date column", () => {
  const rows = [["客户编号", "状态", "更新时间"], ["C018", "待确认", "2026-09-01"], ["C018", "已完成", "2026-09-08"], ["C019", "首次", "2026/09/05 10:30:00"], ["C019", "更新", "2026/09/05 11:30:00"]];
  const latest = deduplicateRows(rows, [0], { keep: "latest", dateIndex: 2 });
  const earliest = deduplicateRows(rows, [0], { keep: "earliest", dateIndex: 2 });
  assert.deepEqual(latest.kept.slice(1).map((row) => row[1]), ["已完成", "更新"]);
  assert.deepEqual(earliest.kept.slice(1).map((row) => row[1]), ["待确认", "首次"]);
});

test("date-based dedupe rejects ambiguous or invalid dates in duplicate groups", () => {
  const rows = [["客户编号", "更新时间"], ["C018", "2026-09-01"], ["C018", "09/08/2026"]];
  assert.throws(() => deduplicateRows(rows, [0], { keep: "latest", dateIndex: 1 }), /数据行 3 无法识别/);
});
test("composite keys cannot collide with separator-like cell content", () => {
  const rows = [["甲", "乙"], ["a\u001fb", "c"], ["a", "b\u001fc"]];
  const result = deduplicateRows(rows, [0, 1]);
  assert.equal(result.kept.length, 3);
  assert.equal(result.duplicates.length, 1);
});

test("two-column compare separates common and one-sided values with counts", () => {
  const rows = [["本月", "上月"], [" A1 ", "A2"], ["a2", "A1"], ["A2", ""], ["", "A3"]];
  const result = compareColumns(rows, 0, 1, { trim: true, ignoreCase: true, ignoreEmpty: true });
  assert.deepEqual(result.common, [["值", "第一列出现次数", "第二列出现次数"], ["A1", 1, 1], ["a2", 2, 1]]);
  assert.deepEqual(result.onlyLeft, [["值", "出现次数"]]);
  assert.deepEqual(result.onlyRight, [["值", "出现次数"], ["A3", 1]]);
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

test("compare exposes field-level old and new values for changed records", () => {
  const left = [["ID", "状态", "金额"], ["A01", "待处理", "100"], ["A02", "完成", "80"]];
  const right = [["ID", "状态", "金额"], ["A01", "完成", "120"], ["A02", "完成", "80"]];
  const result = compareRows(left, right, { left: [0], right: [0] });
  assert.deepEqual(result.changeDetails, [
    ["A01", "状态", "待处理", "完成"],
    ["A01", "金额", "100", "120"]
  ]);
});


test("compare rejects empty key values instead of matching blank records", () => {
  const left = [["ID", "姓名"], ["", "Alice"]];
  const right = [["ID", "姓名"], ["", "Bob"]];
  assert.throws(() => compareRows(left, right, { left: [0], right: [0] }), /旧版关键列“ID”的数据行 2 为空/);
});

test("two-column compare preserves visible whitespace when trim is disabled", () => {
  const rows = [["第一列", "第二列"], [" X ", "X"]];
  const result = compareColumns(rows, 0, 1, { trim: false, ignoreCase: false, ignoreEmpty: true });
  assert.deepEqual(result.onlyLeft, [["值", "出现次数"], [" X ", 1]]);
  assert.deepEqual(result.onlyRight, [["值", "出现次数"], ["X", 1]]);
});

test("compare rejects duplicate keys instead of overwriting rows", () => {
  const left = [["ID", "值"], ["1", "A"], ["1", "B"]];
  const right = [["ID", "值"], ["1", "C"]];
  assert.throws(() => compareRows(left, right, { left: [0], right: [0] }), /旧版关键列存在 1 组重复值.*2、3/);
});

test("filename sanitizer removes reserved characters", () => {
  assert.equal(sanitizeFileName(' 销售/华东:*? '), "销售_华东___");
  assert.equal(sanitizeFileName("[华东]"), "_华东_");
  assert.equal(sanitizeFileName("CON"), "_CON");
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
