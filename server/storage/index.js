const emailLogStore = require("./email-log-store");
const receiptStore = require("./receipt-store");
const { validateEmailLogStore, validateReceiptStore } = require("./interfaces");

function createStorageProviders(overrides = {}) {
  return {
    emailLogStore: validateEmailLogStore(overrides.emailLogStore || emailLogStore),
    receiptStore: validateReceiptStore(overrides.receiptStore || receiptStore)
  };
}

module.exports = {
  createStorageProviders
};
