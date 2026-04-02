const XLSX = require("xlsx");

function normalizeHeader(value = "") {
  return String(value || "").replace(/\s+/g, "").replace(/\n/g, "").trim();
}

function parseNumber(value) {
  const raw = String(value ?? "").replace(/,/g, "").replace(/\s+/g, "").trim();
  if (!raw) return 0;
  const number = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function findHeaderRow(rows) {
  return rows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeHeader(cell));
    return normalized.includes("성명")
      && normalized.includes("등급")
      && normalized.includes("전화번호")
      && normalized.includes("이메일");
  });
}

function buildHeaderMap(headerRow) {
  const map = {};
  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (key) map[key] = index;
  });
  return map;
}

function getCell(row, map, aliases) {
  const key = aliases.find((alias) => map[alias] != null);
  return key == null ? "" : row[map[key]];
}

function normalizePhone(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return String(value || "").trim();
}

function parseBirth(raw = "") {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 8) {
    return {
      birthDate: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`,
      birthYYMMDD: digits.slice(2)
    };
  }
  if (digits.length === 6) {
    const prefix = Number(digits.slice(0, 2)) > 30 ? "19" : "20";
    return {
      birthDate: `${prefix}${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`,
      birthYYMMDD: digits
    };
  }
  return { birthDate: "", birthYYMMDD: "" };
}

function mapGrade(rawGrade = "") {
  const value = String(rawGrade || "").trim().toUpperCase();
  if (!value) return "A";
  if (value.includes("FT")) return "FT";
  if (value.includes("C")) return "C";
  if (value.includes("B")) return "B";
  if (value.includes("A")) return "A";
  if (value.includes("S") || value.includes("특별")) return "A";
  return "A";
}

function createIssue(sourceRow, message, raw) {
  return { sourceRow, message, raw };
}

function parseInstructorImportWorkbook({ buffer }) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames.find((name) => String(name || "").includes("외부강사 리스트")) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex < 0) throw new Error("강사정보 시트에서 필수 헤더를 찾지 못했습니다.");

  const headerMap = buildHeaderMap(rows[headerRowIndex]);
  const issues = [];
  const previewRows = [];

  rows.slice(headerRowIndex + 1).forEach((row, offset) => {
    const sourceRow = headerRowIndex + offset + 2;
    const raw = {
      name: String(getCell(row, headerMap, ["성명"])).trim(),
      rawGrade: String(getCell(row, headerMap, ["등급"])).trim(),
      baseRate: parseNumber(getCell(row, headerMap, ["강사료", "4시간이하"])) || parseNumber(getCell(row, headerMap, ["4시간이상"])),
      phone: normalizePhone(getCell(row, headerMap, ["전화번호"])),
      email: String(getCell(row, headerMap, ["이메일"])).trim().replace(/\s+/g, ""),
      birthRaw: String(getCell(row, headerMap, ["생년월일", "주민번호"])).trim(),
      payoutMethod: String(getCell(row, headerMap, ["지급방식"])).trim(),
      bankName: String(getCell(row, headerMap, ["지급은행"])).trim(),
      accountNumber: String(getCell(row, headerMap, ["계좌번호"])).trim()
    };
    if (!raw.name) return;

    if (!raw.rawGrade && !raw.baseRate && !raw.phone && !raw.email) {
      issues.push(createIssue(sourceRow, "강사정보가 충분하지 않습니다.", raw));
      return;
    }

    const birth = parseBirth(raw.birthRaw);
    previewRows.push({
      sourceRow,
      name: raw.name,
      rawGrade: raw.rawGrade,
      grade: mapGrade(raw.rawGrade),
      baseRate: raw.baseRate,
      phone: raw.phone,
      email: raw.email,
      birthDate: birth.birthDate,
      birthYYMMDD: birth.birthYYMMDD,
      payoutMethod: raw.payoutMethod,
      bankName: raw.bankName,
      accountNumber: raw.accountNumber
    });
  });

  return {
    sheetName,
    headerRow: headerRowIndex + 1,
    rowCount: previewRows.length,
    warnings: issues.map((issue) => `${issue.sourceRow}행: ${issue.message}`),
    issues,
    rows: previewRows
  };
}

module.exports = {
  parseInstructorImportWorkbook
};
