const express = require("express");
const { parseDispatchImportWorkbook } = require("../services/dispatch-import-parser");
const { parseInstructorImportWorkbook } = require("../services/instructor-import-parser");

function createUploadRoutes({ receiptStore }) {
  const router = express.Router();

  router.post("/receipt", async (req, res) => {
    try {
      const result = await receiptStore.saveReceiptDataUrl(req.body?.filename, req.body?.dataUrl);
      return res.json({ ok: true, ...result });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ ok: false, message: "receipt upload failed", error: error.message });
    }
  });

  router.post("/dispatch-import-preview", async (req, res) => {
    try {
      const filename = req.body?.filename || "dispatch-import.xlsx";
      const dataUrl = String(req.body?.dataUrl || "");
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      if (!base64) return res.status(400).json({ ok: false, message: "import file is required" });
      const buffer = Buffer.from(base64, "base64");
      const parsed = parseDispatchImportWorkbook({ filename, buffer });
      return res.json({ ok: true, ...parsed });
    } catch (error) {
      return res.status(400).json({ ok: false, message: "dispatch import preview failed", error: error.message });
    }
  });

  router.post("/instructor-import-preview", async (req, res) => {
    try {
      const dataUrl = String(req.body?.dataUrl || "");
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      if (!base64) return res.status(400).json({ ok: false, message: "import file is required" });
      const buffer = Buffer.from(base64, "base64");
      const parsed = parseInstructorImportWorkbook({ buffer });
      return res.json({ ok: true, ...parsed });
    } catch (error) {
      return res.status(400).json({ ok: false, message: "instructor import preview failed", error: error.message });
    }
  });

  return router;
}

module.exports = createUploadRoutes;
