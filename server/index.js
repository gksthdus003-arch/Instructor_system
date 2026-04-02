const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { HOST, PORT } = require("./config");
const { createApp } = require("./create-app");

const app = createApp();

app.listen(PORT, HOST, () => {
  console.log(`[server] running on http://${HOST}:${PORT}`);
});
