const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { EMAIL_LOG_FILE, LEGACY_EMAIL_LOG_FILE } = require("../config");

async function ensureLogDir() {
  await fsp.mkdir(path.dirname(EMAIL_LOG_FILE), { recursive: true });
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

function readLogs() {
  const current = readJsonFile(EMAIL_LOG_FILE);
  if (current.length) return current;
  return readJsonFile(LEGACY_EMAIL_LOG_FILE);
}

async function writeLogs(logs) {
  await ensureLogDir();
  await fsp.writeFile(EMAIL_LOG_FILE, JSON.stringify(logs, null, 2), "utf8");
}

async function pushLog(log) {
  const merged = [log, ...readLogs()].slice(0, 1000);
  await writeLogs(merged);
}

module.exports = {
  readLogs,
  writeLogs,
  pushLog
};
