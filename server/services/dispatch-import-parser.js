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

function extractYear(filename = "") {
  const match = String(filename || "").match(/(20\d{2})/);
  return Number(match?.[1] || new Date().getFullYear());
}

function toIsoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function expandDateRange(startYear, startMonth, startDay, endYear, endMonth, endDay) {
  const dates = [];
  const current = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  while (current <= end) {
    dates.push(toIsoDate(current.getFullYear(), current.getMonth() + 1, current.getDate()));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function buildDateList(text, year) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const compact = raw.replace(/\s+/g, "");
  const listParts = compact.split(",").map((item) => item.trim()).filter(Boolean);
  if (listParts.length > 1) {
    const expanded = listParts.flatMap((part) => buildDateList(part, year));
    return expanded.length === listParts.length ? [...new Set(expanded)] : [];
  }

  let match = compact.match(/^(\d{1,2})월(\d{1,2})일$/);
  if (match) return [toIsoDate(year, Number(match[1]), Number(match[2]))];

  match = compact.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) return [toIsoDate(year, Number(match[1]), Number(match[2]))];

  match = compact.match(/^(\d{1,2})\/(\d{1,2})[-~](\d{1,2})\/(\d{1,2})$/);
  if (match) return expandDateRange(year, Number(match[1]), Number(match[2]), year, Number(match[3]), Number(match[4]));

  match = compact.match(/^(\d{1,2})월(\d{1,2})일[-~](\d{1,2})월(\d{1,2})일$/);
  if (match) return expandDateRange(year, Number(match[1]), Number(match[2]), year, Number(match[3]), Number(match[4]));

  match = compact.match(/^(\d{1,2})월(\d{1,2})일[-~](\d{1,2})일$/);
  if (match) return expandDateRange(year, Number(match[1]), Number(match[2]), year, Number(match[1]), Number(match[3]));

  match = compact.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return [toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]))];

  return [];
}

function parseTimeCell(value) {
  const raw = String(value || "").trim();
  if (!raw) return { unitType: "hour", units: 0, raw };
  if (/day/i.test(raw)) {
    return { unitType: "day", units: parseNumber(raw) || 1, raw };
  }
  return { unitType: "hour", units: parseNumber(raw), raw };
}

function splitInteger(total, count) {
  const size = Math.max(Number(count || 0), 1);
  const base = Math.floor(Number(total || 0) / size);
  let remainder = Math.round(Number(total || 0) - base * size);
  return Array.from({ length: size }, () => {
    const value = base + (remainder > 0 ? 1 : remainder < 0 ? -1 : 0);
    if (remainder > 0) remainder -= 1;
    if (remainder < 0) remainder += 1;
    return value;
  });
}

function splitHalfUnits(totalUnits, count) {
  const size = Math.max(Number(count || 0), 1);
  const totalHalfUnits = Math.round(Number(totalUnits || 0) * 2);
  const baseHalfUnits = Math.floor(totalHalfUnits / size);
  let remainder = totalHalfUnits - baseHalfUnits * size;
  const parts = Array.from({ length: size }, () => baseHalfUnits);
  let left = 0;
  let right = size - 1;
  while (remainder > 0 && left <= right) {
    parts[right] += 1;
    remainder -= 1;
    if (remainder <= 0) break;
    parts[left] += 1;
    remainder -= 1;
    left += 1;
    right -= 1;
  }
  return parts.map((value) => value / 2);
}

function findHeaderRow(rows) {
  return rows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeHeader(cell));
    return normalized.includes("부서")
      && normalized.includes("구분")
      && normalized.includes("이름")
      && normalized.includes("일자")
      && normalized.includes("과정명")
      && normalized.includes("담당자");
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

function createIssue(sourceRow, message, raw) {
  return { sourceRow, message, raw };
}

function parseDispatchImportWorkbook({ filename, buffer }) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames.find((name) => String(name || "").includes("외주용역집행내역")) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex < 0) throw new Error("업로드 시트에서 필수 헤더를 찾지 못했습니다.");

  const headerMap = buildHeaderMap(rows[headerRowIndex]);
  const year = extractYear(filename);
  const issues = [];
  const previewRows = [];

  rows.slice(headerRowIndex + 1).forEach((row, offset) => {
    const sourceRow = headerRowIndex + offset + 2;
    const raw = {
      department: String(getCell(row, headerMap, ["부서"])).trim(),
      type: String(getCell(row, headerMap, ["구분"])).trim(),
      instructorName: String(getCell(row, headerMap, ["이름"])).trim(),
      dateText: String(getCell(row, headerMap, ["일자"])).trim(),
      clientName: String(getCell(row, headerMap, ["고객사"])).trim(),
      courseName: String(getCell(row, headerMap, ["과정명"])).trim(),
      timeText: String(getCell(row, headerMap, ["시간"])).trim(),
      pay: parseNumber(getCell(row, headerMap, ["강사비", "강사료(시간*시간당강사료or일*일일강사료)", "강사료"])),
      tax: parseNumber(getCell(row, headerMap, ["세금(강사비+교통비)", "세금"])),
      net: parseNumber(getCell(row, headerMap, ["실수령액(강사비-세금+숙박비+교보재)", "실수령액"])),
      transportCost: parseNumber(getCell(row, headerMap, ["교통비"])),
      lodgingCost: parseNumber(getCell(row, headerMap, ["숙박비"])),
      materialCost: parseNumber(getCell(row, headerMap, ["교보재비"])),
      deductionRate: parseNumber(getCell(row, headerMap, ["%", "공제율(3.3/8.8/10)"])),
      managerName: String(getCell(row, headerMap, ["담당자"])).trim(),
      note: String(getCell(row, headerMap, ["비고"])).trim()
    };

    if (!raw.department && !raw.instructorName && !raw.dateText && !raw.courseName) return;
    if (!raw.department || !raw.instructorName || !raw.dateText || !raw.courseName || !raw.managerName) {
      issues.push(createIssue(sourceRow, "필수값이 비어 있습니다.", raw));
      return;
    }

    const dates = buildDateList(raw.dateText, year);
    if (!dates.length) {
      issues.push(createIssue(sourceRow, `날짜를 해석하지 못했습니다. (${raw.dateText})`, raw));
      return;
    }

    const time = parseTimeCell(raw.timeText);
    const splitCount = dates.length;
    const payParts = splitInteger(raw.pay, splitCount);
    const taxParts = splitInteger(raw.tax, splitCount);
    const netParts = splitInteger(raw.net, splitCount);
    const transportParts = splitInteger(raw.transportCost, splitCount);
    const lodgingParts = splitInteger(raw.lodgingCost, splitCount);
    const materialParts = splitInteger(raw.materialCost, splitCount);
    const unitParts = time.unitType === "hour"
      ? splitHalfUnits(time.units || 0, splitCount)
      : Array.from({ length: splitCount }, () => 1);

    dates.forEach((date, index) => {
      const basePay = payParts[index];
      const units = unitParts[index] || (time.unitType === "day" ? 1 : 0);
      const customRate = time.unitType === "day" ? basePay : (units > 0 ? Math.round(basePay / units) : basePay);
      previewRows.push({
        sourceRow,
        department: raw.department,
        type: raw.type,
        instructorName: raw.instructorName,
        date,
        originalDateText: raw.dateText,
        clientName: raw.clientName,
        courseName: raw.courseName,
        timeText: raw.timeText,
        unitType: time.unitType,
        units,
        basePay,
        customRate,
        tax: taxParts[index],
        net: netParts[index],
        transportCost: transportParts[index],
        lodgingCost: lodgingParts[index],
        materialCost: materialParts[index],
        deductionRate: raw.deductionRate,
        managerName: raw.managerName,
        note: raw.note,
        splitCount
      });
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
  parseDispatchImportWorkbook
};
