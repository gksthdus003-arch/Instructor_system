const express = require("express");

function createEmailRoutes({ emailLogStore, mailerService }) {
  const router = express.Router();

  router.get("/logs", (_req, res) => {
    res.json({ logs: emailLogStore.readLogs().slice(0, 50) });
  });

  router.post("/verify", async (req, res) => {
    const { host, port, secure, user, pass } = req.body || {};
    try {
      const config = await mailerService.verifyTransporter({ host, port, secure, user, pass });
      return res.json({ ok: true, message: "SMTP verify success", config });
    } catch (error) {
      return res.status(500).json({ ok: false, message: "SMTP verify failed", error: error.message });
    }
  });

  router.post("/test", async (req, res) => {
    try {
      await mailerService.sendTestEmail(req.body?.to);
      return res.json({ ok: true, message: "테스트 메일 발송 성공" });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ ok: false, message: "테스트 메일 발송 실패", error: error.message });
    }
  });

  router.post("/send-one", async (req, res) => {
    try {
      const result = await mailerService.sendOneCore(req.body);
      return res.json({ ok: true, status: "sent", ...result });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ ok: false, status: "failed", message: error.message });
    }
  });

  router.post("/send-batch", async (req, res) => {
    const { periodStart, periodEnd, instructors, itemsByInstructor } = req.body || {};
    if (!periodStart || !periodEnd || !Array.isArray(instructors) || !itemsByInstructor || typeof itemsByInstructor !== "object") {
      return res.status(400).json({ ok: false, message: "periodStart, periodEnd, instructors[], itemsByInstructor{} are required" });
    }

    const results = [];
    for (const instructor of instructors) {
      const items = Array.isArray(itemsByInstructor[instructor.id]) ? itemsByInstructor[instructor.id] : [];
      try {
        await mailerService.sendOneCore({ periodStart, periodEnd, instructor, items });
        results.push({ instructorId: instructor.id, status: "sent" });
      } catch (error) {
        results.push({ instructorId: instructor.id, status: "failed", error: error.message });
      }
    }

    return res.json({ ok: true, count: results.length, results });
  });

  router.post("/request-notice", async (req, res) => {
    try {
      const result = await mailerService.sendRequestNotice(req.body || {});
      return res.json({ ok: true, status: "sent", ...result });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ ok: false, status: "failed", message: error.message });
    }
  });

  return router;
}

module.exports = createEmailRoutes;
