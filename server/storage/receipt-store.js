const fsp = require("fs/promises");
const path = require("path");
const { RECEIPT_DIR } = require("../config");

function safeFilename(name = "") {
  return String(name || "receipt")
    .replace(/[^\w.\-()]/g, "_")
    .slice(0, 80);
}

async function saveReceiptDataUrl(filename, dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") {
    const error = new Error("dataUrl is required");
    error.statusCode = 400;
    throw error;
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    const error = new Error("invalid dataUrl");
    error.statusCode = 400;
    throw error;
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const extMap = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf"
  };
  const ext = extMap[mimeType] || path.extname(filename || "") || ".bin";
  const uniqueName = `${Date.now()}_${safeFilename(path.basename(filename || "receipt"))}`.replace(/\.[^.]*$/, "") + ext;
  const fullPath = path.join(RECEIPT_DIR, uniqueName);

  await fsp.mkdir(RECEIPT_DIR, { recursive: true });
  await fsp.writeFile(fullPath, Buffer.from(base64Data, "base64"));

  return {
    url: `/uploads/receipts/${uniqueName}`,
    filename: uniqueName,
    mimeType
  };
}

module.exports = {
  saveReceiptDataUrl
};
