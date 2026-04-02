const express = require("express");
const cors = require("cors");
const {
  FRONTEND_ROOT,
  PREVIEW_FILE,
  STITCH_DIR,
  UPLOAD_ROOT
} = require("./config");
const createEmailRoutes = require("./routes/email-routes");
const createUploadRoutes = require("./routes/upload-routes");
const { createMailerService } = require("./services/mailer");
const { createStorageProviders } = require("./storage");

function createApp({ storageProviders } = {}) {
  const app = express();
  const storage = createStorageProviders(storageProviders);
  const mailerService = createMailerService({ emailLogStore: storage.emailLogStore });

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use("/stitch", express.static(STITCH_DIR));
  app.use("/app", express.static(FRONTEND_ROOT));
  app.use("/uploads", express.static(UPLOAD_ROOT));

  app.get("/", (_req, res) => res.type("text/plain").send("OK - Instructor Management API"));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/preview", (_req, res) => res.sendFile(PREVIEW_FILE));

  app.use("/api/email", createEmailRoutes({ emailLogStore: storage.emailLogStore, mailerService }));
  app.use("/api/uploads", createUploadRoutes({ receiptStore: storage.receiptStore }));

  return app;
}

module.exports = {
  createApp
};
