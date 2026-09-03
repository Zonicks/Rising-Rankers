import assert from "node:assert/strict";
import { test } from "node:test";
import { mapBookImportRows, mapMcqImportRows, parseCsv } from "./import-parse";

test("parseCsv maps path aliases and MCQ fields", () => {
  const csv = `Program,Subject,Book,Author,Chapter,Category,Subcategory,Question,Option A,Option B,Option C,Option D,Correct Option,Explanation,Difficulty
UPSC,Polity,Indian Polity,M. Laxmikanth,Fundamental Rights,Rights,Equality,Article 14 guarantees,Right to property,Equality before law,Freedom of speech,Right to education,B,Equality before law,medium
`;
  const rows = parseCsv(csv);
  const mapped = mapMcqImportRows(rows);
  assert.equal(mapped.errors.length, 0);
  assert.equal(mapped.items.length, 1);
  const item = mapped.items[0];
  assert.equal(item.program, "UPSC");
  assert.equal(item.book, "Indian Polity");
  assert.equal(item.author, "M. Laxmikanth");
  assert.equal(item.category, "Rights");
  assert.equal(item.correctOption, "B");
  assert.equal(item.row, 2);
});

test("mapBookImportRows reads catalog fields and price", () => {
  const csv = `program,subject,book,author,subtitle,price,includedInProgram,chapter
UPSC,Polity,Indian Polity,M. Laxmikanth,For Civil Services,0,yes,Fundamental Rights
`;
  const mapped = mapBookImportRows(parseCsv(csv));
  assert.equal(mapped.errors.length, 0);
  assert.equal(mapped.items.length, 1);
  assert.equal(mapped.items[0].book, "Indian Polity");
  assert.equal(mapped.items[0].author, "M. Laxmikanth");
  assert.equal(mapped.items[0].price, 0);
  assert.equal(mapped.items[0].includedInProgram, true);
  assert.equal(mapped.items[0].chapter, "Fundamental Rights");
});

test("mapBookImportRows reads questions on the same row", () => {
  const csv = `program,subject,book,author,chapter,question,optionA,optionB,optionC,optionD,correctOption
UPSC,Polity,Indian Polity,M. Laxmikanth,Fundamental Rights,Article 14 guarantees,Right to property,Equality before law,Freedom of speech,Right to education,B
`;
  const mapped = mapBookImportRows(parseCsv(csv));
  assert.equal(mapped.errors.length, 0);
  assert.equal(mapped.items[0].question, "Article 14 guarantees");
  assert.equal(mapped.items[0].correctOption, "B");
});

test("mapBookImportRows requires category when subcategory is set", () => {
  const csv = `program,subject,book,chapter,subcategory
UPSC,Polity,Indian Polity,Fundamental Rights,Equality
`;
  const mapped = mapBookImportRows(parseCsv(csv));
  assert.equal(mapped.items.length, 0);
  assert.equal(mapped.errors[0]?.message.includes("category"), true);
});

test("mapBookImportRows keeps category and subcategory", () => {
  const csv = `program,subject,book,chapter,category,subcategory
UPSC,Polity,Indian Polity,Fundamental Rights,Rights,Equality
`;
  const mapped = mapBookImportRows(parseCsv(csv));
  assert.equal(mapped.errors.length, 0);
  assert.equal(mapped.items[0].category, "Rights");
  assert.equal(mapped.items[0].subcategory, "Equality");
});

test("mapMcqImportRows reports missing options", () => {
  const rows = parseCsv(`question,optionA,optionB,optionC,optionD,correctOption
What?,A,B,,D,A
`);
  const mapped = mapMcqImportRows(rows);
  assert.equal(mapped.items.length, 0);
  assert.equal(mapped.errors[0]?.message.includes("optionC"), true);
});
