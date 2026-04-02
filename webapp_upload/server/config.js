const path = require("path");

const SERVER_ROOT = __dirname;
const PROJECT_ROOT = path.join(SERVER_ROOT, "..");
const resolveStorageRoot = () => {
  const raw = process.env.APP_STORAGE_DIR || path.join("server", "data");
  return path.isAbsolute(raw) ? raw : path.resolve(PROJECT_ROOT, raw);
};

const STORAGE_ROOT = resolveStorageRoot();

module.exports = {
  HOST: process.env.HOST || "127.0.0.1",
  PORT: Number(process.env.PORT || 4000),
  PROJECT_ROOT,
  FRONTEND_ROOT: PROJECT_ROOT,
  PREVIEW_FILE: path.join(PROJECT_ROOT, "stitch-preview.html"),
  STITCH_DIR: path.join(PROJECT_ROOT, "..", "stitch_instructor_list_view"),
  STORAGE_ROOT,
  UPLOAD_ROOT: path.join(STORAGE_ROOT, "uploads"),
  RECEIPT_DIR: path.join(STORAGE_ROOT, "uploads", "receipts"),
  EMAIL_LOG_FILE: path.join(STORAGE_ROOT, "logs", "email-log.json"),
  LEGACY_EMAIL_LOG_FILE: path.join(SERVER_ROOT, "email-log.json")
};
