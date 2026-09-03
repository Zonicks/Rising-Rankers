export type SpreadsheetRow = Record<string, string>;

export type RowError = { row: number; message: string };

export type ImportPathDraft = {
  program?: string;
  subject?: string;
  book?: string;
  author?: string;
  chapter?: string;
  category?: string;
  subcategory?: string;
  chapterId?: string;
  row: number;
};

export type McqImportDraft = ImportPathDraft & {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
  explanation?: string;
  topic?: string;
  difficulty?: string;
};

export type FlashImportDraft = ImportPathDraft & {
  front: string;
  back: string;
  topic?: string;
  difficulty?: string;
};

export type BookImportDraft = {
  program: string;
  subject: string;
  book: string;
  author?: string;
  subtitle?: string;
  price?: number;
  includedInProgram?: boolean;
  chapter?: string;
  category?: string;
  subcategory?: string;
  question?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: "A" | "B" | "C" | "D";
  explanation?: string;
  topic?: string;
  difficulty?: string;
  row?: number;
};

export function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_\-./]+/g, "");
}

function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function objectFromHeaders(headers: string[], values: string[]): SpreadsheetRow {
  const out: SpreadsheetRow = {};
  headers.forEach((h, i) => {
    if (!h) return;
    out[h] = (values[i] ?? "").trim();
  });
  return out;
}

export function parseCsv(text: string): SpreadsheetRow[] {
  const records = parseCsvRecords(text);
  if (records.length < 2) return [];
  const headers = records[0].map(normalizeHeader);
  return records.slice(1).map((values) => objectFromHeaders(headers, values));
}

function normalizeObjectRow(raw: Record<string, unknown>): SpreadsheetRow {
  const out: SpreadsheetRow = {};
  for (const [key, value] of Object.entries(raw)) {
    const header = normalizeHeader(key);
    if (!header) continue;
    out[header] = value == null ? "" : String(value).trim();
  }
  return out;
}

export function pick(row: SpreadsheetRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value) return value;
  }
  return "";
}

function optional(value: string): string | undefined {
  return value ? value : undefined;
}

function parseCorrectOption(raw: string): "A" | "B" | "C" | "D" | null {
  const v = raw.trim().toUpperCase();
  if (v === "A" || v === "B" || v === "C" || v === "D") return v;
  if (v.startsWith("OPTION")) {
    const letter = v.replace("OPTION", "").trim();
    if (letter === "A" || letter === "B" || letter === "C" || letter === "D") return letter;
  }
  return null;
}

function pathFromRow(row: SpreadsheetRow, n: number, chapterId?: string): ImportPathDraft {
  return {
    program: optional(pick(row, "program", "exam")),
    subject: optional(pick(row, "subject")),
    book: optional(pick(row, "book", "booktitle")),
    author: optional(pick(row, "author", "authorname")),
    chapter: optional(pick(row, "chapter", "chaptertitle")),
    category: optional(pick(row, "category")),
    subcategory: optional(pick(row, "subcategory", "subcat")),
    chapterId,
    row: n,
  };
}

export function mapMcqImportRows(
  rows: SpreadsheetRow[],
  chapterId?: string
): { items: McqImportDraft[]; errors: RowError[] } {
  const items: McqImportDraft[] = [];
  const errors: RowError[] = [];

  rows.forEach((row, i) => {
    const n = i + 2;
    const question = pick(row, "question", "q", "prompt");
    const optionA = pick(row, "optionA", "a", "option1");
    const optionB = pick(row, "optionB", "b", "option2");
    const optionC = pick(row, "optionC", "c", "option3");
    const optionD = pick(row, "optionD", "d", "option4");
    const correct = parseCorrectOption(pick(row, "correctOption", "answer", "correct", "key"));
    const missing: string[] = [];
    if (!question) missing.push("question");
    if (!optionA) missing.push("optionA");
    if (!optionB) missing.push("optionB");
    if (!optionC) missing.push("optionC");
    if (!optionD) missing.push("optionD");
    if (!correct) missing.push("correctOption (A–D)");
    if (missing.length) {
      errors.push({ row: n, message: `Missing ${missing.join(", ")}` });
      return;
    }
    items.push({
      ...pathFromRow(row, n, chapterId),
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption: correct!,
      explanation: optional(pick(row, "explanation", "explain", "rationale")),
      topic: optional(pick(row, "topic")),
      difficulty: optional(pick(row, "difficulty", "level")),
    });
  });

  return { items, errors };
}

function parseIncluded(raw: string): boolean | undefined {
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (["yes", "true", "1", "y", "included", "in", "free"].includes(v)) return true;
  if (["no", "false", "0", "n", "paid", "addon", "add-on"].includes(v)) return false;
  return undefined;
}

export function mapBookImportRows(rows: SpreadsheetRow[]): { items: BookImportDraft[]; errors: RowError[] } {
  const items: BookImportDraft[] = [];
  const errors: RowError[] = [];

  rows.forEach((row, i) => {
    const n = i + 2;
    const program = pick(row, "program", "exam");
    const subject = pick(row, "subject");
    const book = pick(row, "book", "booktitle", "title");
    const missing: string[] = [];
    if (!program) missing.push("program");
    if (!subject) missing.push("subject");
    if (!book) missing.push("book");
    if (missing.length) {
      errors.push({ row: n, message: `Missing ${missing.join(", ")}` });
      return;
    }
    const priceRaw = pick(row, "price", "amount");
    let price: number | undefined;
    if (priceRaw) {
      const parsed = Number(priceRaw.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.push({ row: n, message: "price must be a number 0 or more" });
        return;
      }
      price = parsed;
    }
    const includedRaw = pick(row, "includedInProgram", "included", "inprogram", "insyllabus");
    const chapter = optional(pick(row, "chapter", "chaptertitle"));
    const category = optional(pick(row, "category"));
    const subcategory = optional(pick(row, "subcategory", "subcat"));
    if (subcategory && !category) {
      errors.push({ row: n, message: "category is required when subcategory is set" });
      return;
    }
    if ((category || subcategory) && !chapter) {
      errors.push({ row: n, message: "chapter is required when category or subcategory is set" });
      return;
    }
    const question = optional(pick(row, "question", "q", "prompt"));
    const optionA = optional(pick(row, "optionA", "a", "option1"));
    const optionB = optional(pick(row, "optionB", "b", "option2"));
    const optionC = optional(pick(row, "optionC", "c", "option3"));
    const optionD = optional(pick(row, "optionD", "d", "option4"));
    const correct = parseCorrectOption(pick(row, "correctOption", "answer", "correct", "key"));
    const hasQuestionBits = Boolean(question || optionA || optionB || optionC || optionD || correct);
    if (hasQuestionBits) {
      const qMissing: string[] = [];
      if (!chapter) qMissing.push("chapter");
      if (!question) qMissing.push("question");
      if (!optionA) qMissing.push("optionA");
      if (!optionB) qMissing.push("optionB");
      if (!optionC) qMissing.push("optionC");
      if (!optionD) qMissing.push("optionD");
      if (!correct) qMissing.push("correctOption (A–D)");
      if (qMissing.length) {
        errors.push({ row: n, message: `Missing ${qMissing.join(", ")}` });
        return;
      }
    }
    items.push({
      program,
      subject,
      book,
      author: optional(pick(row, "author", "authorname")),
      subtitle: optional(pick(row, "subtitle", "tagline")),
      price,
      includedInProgram: parseIncluded(includedRaw),
      chapter,
      category,
      subcategory,
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption: correct ?? undefined,
      explanation: optional(pick(row, "explanation", "explain", "rationale")),
      topic: optional(pick(row, "topic")),
      difficulty: optional(pick(row, "difficulty", "level")),
      row: n,
    });
  });

  return { items, errors };
}

export function mapFlashImportRows(
  rows: SpreadsheetRow[],
  chapterId?: string
): { items: FlashImportDraft[]; errors: RowError[] } {
  const items: FlashImportDraft[] = [];
  const errors: RowError[] = [];

  rows.forEach((row, i) => {
    const n = i + 2;
    const front = pick(row, "front", "prompt", "question", "term");
    const back = pick(row, "back", "answer", "definition");
    if (!front || !back) {
      errors.push({
        row: n,
        message: `Missing ${[!front && "front", !back && "back"].filter(Boolean).join(" and ")}`,
      });
      return;
    }
    items.push({
      ...pathFromRow(row, n, chapterId),
      front,
      back,
      topic: optional(pick(row, "topic")),
      difficulty: optional(pick(row, "difficulty", "level")),
    });
  });

  return { items, errors };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function parseSpreadsheetBuffer(
  buffer: Buffer,
  filename: string
): Promise<SpreadsheetRow[]> {
  const name = filename.toLowerCase();
  if (name.endsWith(".json")) {
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : null;
    if (!list) throw new Error("JSON must be an array, or { items: [...] }");
    return list
      .filter((row) => row && typeof row === "object")
      .map((row) => normalizeObjectRow(row as Record<string, unknown>));
  }

  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsv(buffer.toString("utf8"));
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
      defval: "",
      raw: false,
    });
    return json.map(normalizeObjectRow);
  }

  throw new Error("Use a .csv, .xlsx, .xls, or .json file");
}
