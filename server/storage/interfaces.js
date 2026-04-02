function assertFunction(target, key, label) {
  if (!target || typeof target[key] !== "function") {
    throw new Error(`${label} must implement ${key}()`);
  }
}

function validateEmailLogStore(store) {
  assertFunction(store, "readLogs", "emailLogStore");
  assertFunction(store, "writeLogs", "emailLogStore");
  assertFunction(store, "pushLog", "emailLogStore");
  return store;
}

function validateReceiptStore(store) {
  assertFunction(store, "saveReceiptDataUrl", "receiptStore");
  return store;
}

module.exports = {
  validateEmailLogStore,
  validateReceiptStore
};
