const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

const FONT_REGULAR = "C:\\Windows\\Fonts\\malgun.ttf";
const FONT_BOLD = "C:\\Windows\\Fonts\\malgunbd.ttf";

function toNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function escHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function validWithholding(rate) {
  return [3.3, 8.8, 10].includes(toNumber(rate));
}

function formatKoreanMonth(periodStart = "") {
  const match = String(periodStart || "").match(/^(\d{4})-(\d{2})/);
  if (!match) return "";
  return `${match[1]}년 ${match[2]}월`;
}

function formatMoney(value) {
  return `${toNumber(value).toLocaleString("ko-KR")}원`;
}

function publicQualifier(rawQualifier = "") {
  return String(rawQualifier || "").trim().toUpperCase() === "FT" ? "FT" : "강사";
}

function calcItemAmounts(item, withholdingRate) {
  const qty = toNumber(item.qty);
  const unitPrice = toNumber(item.unitPrice);
  const transport = toNumber(item.transport);
  const lodging = toNumber(item.lodging);
  const materials = toNumber(item.materials);
  const amount = unitPrice * qty;
  const taxableBase = amount + transport;
  const withholding = Math.round(taxableBase * (withholdingRate / 100));
  const net = taxableBase - withholding + lodging + materials;
  return {
    qty,
    amount,
    transport,
    lodging,
    materials,
    withholding,
    net
  };
}

function summaryOf(instructor, items) {
  const withholdingRate = toNumber(instructor.withholding);
  if (!validWithholding(withholdingRate)) {
    const error = new Error("instructor.withholding must be 3.3, 8.8, or 10");
    error.statusCode = 400;
    throw error;
  }

  const detailItems = items.map((item) => ({
    ...item,
    amounts: calcItemAmounts(item, withholdingRate)
  }));

  return {
    withholdingRate,
    totalCount: detailItems.length,
    totalQty: detailItems.reduce((sum, item) => sum + item.amounts.qty, 0),
    gross: detailItems.reduce((sum, item) => sum + item.amounts.amount, 0),
    transport: detailItems.reduce((sum, item) => sum + item.amounts.transport, 0),
    lodging: detailItems.reduce((sum, item) => sum + item.amounts.lodging, 0),
    materials: detailItems.reduce((sum, item) => sum + item.amounts.materials, 0),
    withholdingAmount: detailItems.reduce((sum, item) => sum + item.amounts.withholding, 0),
    net: detailItems.reduce((sum, item) => sum + item.amounts.net, 0),
    detailItems
  };
}

function buildSettlementFilename(payload) {
  const monthLabel = formatKoreanMonth(payload.periodStart);
  const instructorName = payload.instructor?.name || "강사";
  const qualifier = publicQualifier(payload.instructor?.qualifier);
  return `[루트컨설팅] ${monthLabel} 강사료 내역_${instructorName} ${qualifier}.pdf`;
}

function createTransporter(overrides = {}) {
  const host = overrides.host || process.env.SMTP_HOST || "ezsmtp.bizmeka.com";
  const port = Number(overrides.port || process.env.SMTP_PORT || 587);
  const secure = typeof overrides.secure === "boolean" ? overrides.secure : port === 465;
  const user = overrides.user || process.env.SMTP_USER || "root@rootconsulting.co.kr";
  const pass = overrides.pass || process.env.SMTP_PASS;
  const fromEmail = process.env.MAIL_FROM || "root@rootconsulting.co.kr";
  const fromName = process.env.MAIL_FROM_NAME || "Root Consulting";

  if (!pass) {
    const error = new Error("SMTP_PASS is required");
    error.statusCode = 500;
    throw error;
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    }),
    from: `"${fromName}" <${fromEmail}>`,
    configSummary: { host, port, secure, user }
  };
}

function validateSendOne(payload) {
  if (!payload || typeof payload !== "object") return "request body is required";
  if (!payload.periodStart || !payload.periodEnd) return "periodStart and periodEnd are required";
  if (!payload.instructor || typeof payload.instructor !== "object") return "instructor is required";
  if (!Array.isArray(payload.items)) return "items must be an array";
  if (!payload.instructor.birthYYMMDD) return "instructor.birthYYMMDD is required";
  if (!payload.instructor.email) return "instructor.email is required";
  if (!validWithholding(payload.instructor.withholding)) return "instructor.withholding must be 3.3, 8.8, or 10";
  return null;
}

function createRequestNoticeHtml({ summary, message, actionUrl, senderName }) {
  return `<!doctype html>
  <html>
    <body style="margin:0;background:#f7f7f7;font-family:'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#222;">
      <div style="max-width:720px;margin:0 auto;padding:40px 24px;">
        <div style="background:#fff;border:1px solid #e5e7eb;padding:44px 40px;">
          <div style="font-size:16px;font-weight:700;margin-bottom:28px;">강의 일정 요청</div>
          <div style="font-size:34px;font-weight:800;line-height:1.35;margin-bottom:24px;">강의 일정 회신 요청</div>
          <div style="font-size:16px;line-height:1.8;color:#4b5563;margin-bottom:14px;">${summary || "새로운 강의 일정 회신 요청이 도착했습니다."}</div>
          ${message ? `<div style="font-size:15px;line-height:1.8;color:#4b5563;margin-bottom:24px;white-space:pre-line;">${escHtml(message)}</div>` : ""}
          <a href="${actionUrl}" style="display:inline-block;padding:14px 26px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;">확인하기</a>
          <div style="margin-top:36px;font-size:13px;line-height:1.7;color:#9ca3af;">
            본 메일은 발신전용입니다. 회신은 시스템의 강의 일정 요청 화면에서 확인하실 수 있습니다.<br />
            발신자: ${escHtml(senderName)}
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

function createSettlementMailHtml(payload, attachmentName) {
  return `<!doctype html>
  <html>
    <body style="margin:0;background:#f7f7f7;font-family:'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#0f172a;">
      <div style="max-width:760px;margin:0 auto;padding:40px 24px;">
        <div style="background:#ffffff;border:1px solid #dbe5f0;border-radius:22px;padding:40px;">
          <div style="font-size:16px;font-weight:800;color:#1d4ed8;margin-bottom:18px;">루트컨설팅</div>
          <div style="font-size:30px;font-weight:800;line-height:1.35;margin-bottom:20px;">${escHtml(payload.instructor.name)} ${publicQualifier(payload.instructor.qualifier)}님, 안녕하세요.</div>
          <div style="font-size:16px;line-height:1.9;color:#334155;">
            지난 한 달도 루트컨설팅과 함께 해주셔서 진심으로 감사드립니다.<br /><br />
            진행 내역을 첨부파일에서 확인해 주시고,<br />
            오류 · 수정사항이 있으시다면 회신 부탁드립니다.
          </div>
          <div style="margin-top:24px;padding:18px 20px;border-radius:16px;background:#eff6ff;border:1px solid #bfdbfe;">
            <div style="font-size:14px;font-weight:800;color:#1e3a8a;">첨부파일 안내</div>
            <div style="margin-top:8px;font-size:14px;line-height:1.8;color:#334155;">
              파일명: ${escHtml(attachmentName)}<br />
              비밀번호 : <b>생년월일(YYMMDD)</b>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

function setupFonts(doc) {
  doc.registerFont("Malgun", FONT_REGULAR);
  doc.registerFont("Malgun-Bold", FONT_BOLD);
  doc.font("Malgun");
}

function text(doc, value, x, y, options = {}) {
  const font = options.bold ? "Malgun-Bold" : "Malgun";
  const nextOptions = { ...options };
  delete nextOptions.bold;
  doc.font(font).text(value, x, y, nextOptions);
}

function drawCard(doc, x, y, width, height, label, value, valueSize = 20) {
  doc.roundedRect(x, y, width, height, 12).fill("#f8fbff");
  doc.fillColor("#64748b").fontSize(9);
  text(doc, label, x + 14, y + 12, { bold: true, width: width - 28 });
  doc.fillColor("#0f172a").fontSize(valueSize);
  text(doc, value, x + 14, y + 34, { bold: true, width: width - 28 });
}

function drawTableHeader(doc, x, y, columns) {
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  doc.fillColor("#e8f0fb").rect(x, y, totalWidth, 24).fill();
  let cursor = x;
  columns.forEach((column) => {
    doc.fillColor("#0f172a").fontSize(8);
    text(doc, column.label, cursor + 4, y + 7, {
      width: column.width - 8,
      align: column.align || "left",
      bold: true
    });
    cursor += column.width;
  });
}

async function buildPdf(filePath, payload, summary, pdfPassword) {
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 36,
      userPassword: pdfPassword,
      ownerPassword: `owner-${pdfPassword}-${Date.now()}`,
      permissions: {
        printing: "highResolution",
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: false,
        contentAccessibility: true,
        documentAssembly: false
      }
    });

    const out = fs.createWriteStream(filePath);
    doc.pipe(out);
    setupFonts(doc);

    const startX = 36;
    const pageWidth = 770;

    doc.roundedRect(startX, 32, pageWidth, 116, 18).fill("#eef6ff");
    doc.fillColor("#1d4ed8").fontSize(12);
    text(doc, "루트컨설팅 강사료 내역", 58, 50, { bold: true });
    doc.fillColor("#0f172a").fontSize(22);
    text(doc, `${formatKoreanMonth(payload.periodStart)} 강사료 내역`, 58, 70, { bold: true });
    doc.fillColor("#0f172a").fontSize(18);
    text(doc, `${payload.instructor.name} ${publicQualifier(payload.instructor.qualifier)}`, 58, 104, {
      bold: true,
      width: 730
    });

    const cardY = 168;
    drawCard(doc, startX, cardY, 380, 72, "총 금액", formatMoney(summary.net), 22);
    drawCard(doc, startX + 390, cardY, 185, 72, "총 진행 횟수", `${summary.totalCount}회`, 22);
    drawCard(doc, startX + 585, cardY, 185, 72, "공제율", `${summary.withholdingRate}%`, 22);

    doc.fillColor("#0f172a").fontSize(13);
    text(doc, "상세 내역", startX, 270, { bold: true });

    const columns = [
      { label: "No", width: 24, align: "center" },
      { label: "일자", width: 56 },
      { label: "고객사", width: 70 },
      { label: "과정명", width: 118 },
      { label: "구분", width: 32, align: "center" },
      { label: "수량", width: 28, align: "right" },
      { label: "금액", width: 56, align: "right" },
      { label: "공제액", width: 56, align: "right" },
      { label: "실수령액", width: 60, align: "right" },
      { label: "교통비", width: 44, align: "right" },
      { label: "숙박비", width: 44, align: "right" },
      { label: "교보재비", width: 48, align: "right" },
      { label: "담당자", width: 54 },
      { label: "비고", width: 80 }
    ];

    const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const drawHeader = (y) => {
      doc.fillColor("#e8f0fb").rect(startX, y, tableWidth, 24).fill();
      let cursor = startX;
      columns.forEach((column) => {
        doc.fillColor("#0f172a").fontSize(7);
        text(doc, column.label, cursor + 4, y + 7, {
          width: column.width - 8,
          align: column.align || "left",
          bold: true
        });
        cursor += column.width;
      });
    };

    const maxRowY = 516;
    let rowY = 320;
    drawHeader(294);

    summary.detailItems.forEach((item, index) => {
      if (rowY > maxRowY) {
        doc.addPage();
        setupFonts(doc);
        drawHeader(40);
        rowY = 66;
      }

      const values = [
        String(index + 1),
        item.date || "",
        item.client || "",
        item.course || "",
        item.unit || "",
        String(item.amounts.qty),
        formatMoney(item.amounts.amount),
        formatMoney(item.amounts.withholding),
        formatMoney(item.amounts.net),
        formatMoney(item.amounts.transport),
        formatMoney(item.amounts.lodging),
        formatMoney(item.amounts.materials),
        item.manager || "",
        item.note || ""
      ];

      doc.fillColor(index % 2 ? "#ffffff" : "#f8fafc").rect(startX, rowY - 2, tableWidth, 24).fill();
      let cursor = startX;
      columns.forEach((column, columnIndex) => {
        doc.fillColor("#1f2937").fontSize(7);
        text(doc, values[columnIndex], cursor + 4, rowY + 4, {
          width: column.width - 8,
          align: column.align || "left",
          ellipsis: true
        });
        cursor += column.width;
      });
      rowY += 24;
    });

    if (rowY > maxRowY) {
      doc.addPage();
      setupFonts(doc);
      drawHeader(40);
      rowY = 66;
    }

    doc.fillColor("#f3f4f6").rect(startX, rowY - 2, tableWidth, 24).fill();
    doc.fillColor("#0f172a").fontSize(8);
    const totalLabelWidth = columns.slice(0, 8).reduce((sum, column) => sum + column.width, 0);
    text(doc, "총계", startX + 4, rowY + 4, {
      width: totalLabelWidth - 8,
      align: "right",
      bold: true
    });
    const netX = startX + totalLabelWidth;
    text(doc, formatMoney(summary.net), netX + 4, rowY + 4, {
      width: columns[8].width - 8,
      align: "right",
      bold: true
    });

    doc.end();
    out.on("finish", resolve);
    out.on("error", reject);
  });
}

function createMailerService({ emailLogStore }) {
  async function sendRequestNotice(payload) {
    if (!payload?.to) {
      const error = new Error("to is required");
      error.statusCode = 400;
      throw error;
    }
    if (!payload?.actionUrl) {
      const error = new Error("actionUrl is required");
      error.statusCode = 400;
      throw error;
    }

    const { transporter, from } = createTransporter();
    const subject = payload.subject || "[강의 일정 요청] 회신이 필요한 일정이 도착했습니다.";
    const message = String(payload.message || "").trim();
    const summary = String(payload.summary || "").trim();
    const senderName = String(payload.senderName || "운영 담당자").trim();

    await transporter.sendMail({
      from,
      to: payload.to,
      subject,
      text: [summary || "강의 일정 회신 요청이 도착했습니다.", message, `확인하기: ${payload.actionUrl}`].filter(Boolean).join("\n\n"),
      html: createRequestNoticeHtml({ summary, message, actionUrl: payload.actionUrl, senderName })
    });

    const log = {
      instructorId: payload.instructorId || "",
      toEmail: payload.to,
      period: payload.requestId || "request-notice",
      status: "sent",
      sentAt: new Date().toISOString(),
      errorMessage: ""
    };
    await emailLogStore.pushLog(log);
    return { log };
  }

  async function sendOneCore(payload) {
    const validationError = validateSendOne(payload);
    if (validationError) {
      const error = new Error(validationError);
      error.statusCode = 400;
      throw error;
    }

    const summary = summaryOf(payload.instructor, payload.items);
    const attachmentName = buildSettlementFilename(payload);
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "ims-mail-"));
    const pdfPath = path.join(tempDir, attachmentName);

    try {
      await buildPdf(pdfPath, payload, summary, payload.instructor.birthYYMMDD);

      const { transporter, from } = createTransporter();
      await transporter.sendMail({
        from,
        to: payload.instructor.email,
        subject: `[루트컨설팅] ${formatKoreanMonth(payload.periodStart)} 강사료 내역 안내`,
        text: [
          `${payload.instructor.name} ${publicQualifier(payload.instructor.qualifier)}님, 안녕하세요. 루트컨설팅입니다.`,
          "지난 한 달도 루트컨설팅과 함께 해주셔서 진심으로 감사드립니다.",
          "진행 내역을 첨부파일에서 확인해 주시고,",
          "오류 · 수정사항이 있으시다면 회신 부탁드립니다.",
          "비밀번호 : 생년월일(YYMMDD)"
        ].join("\n"),
        html: createSettlementMailHtml(payload, attachmentName),
        attachments: [
          {
            filename: attachmentName,
            path: pdfPath
          }
        ]
      });

      const log = {
        instructorId: payload.instructor.id || "",
        toEmail: payload.instructor.email,
        period: `${payload.periodStart}~${payload.periodEnd}`,
        status: "sent",
        sentAt: new Date().toISOString(),
        errorMessage: ""
      };
      await emailLogStore.pushLog(log);
      return { summary, log };
    } catch (error) {
      const log = {
        instructorId: payload.instructor.id || "",
        toEmail: payload.instructor.email || "",
        period: `${payload.periodStart || ""}~${payload.periodEnd || ""}`,
        status: "failed",
        sentAt: new Date().toISOString(),
        errorMessage: error.message
      };
      await emailLogStore.pushLog(log);
      throw error;
    } finally {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async function verifyTransporter(options = {}) {
    const { transporter, configSummary } = createTransporter(options);
    await transporter.verify();
    return configSummary;
  }

  async function sendTestEmail(to) {
    if (!to) {
      const error = new Error("to is required");
      error.statusCode = 400;
      throw error;
    }
    const { transporter, from } = createTransporter();
    await transporter.sendMail({
      from,
      to,
      subject: "[TEST] SMTP connection check",
      text: "SMTP test mail"
    });
  }

  return {
    sendRequestNotice,
    sendOneCore,
    sendTestEmail,
    verifyTransporter
  };
}

module.exports = {
  createMailerService
};
