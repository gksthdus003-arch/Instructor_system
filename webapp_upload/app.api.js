window.apiGet = async function apiGet(path) {
  const response = await fetch(`${window.IMS_CONFIG.apiBaseUrl}${path}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || `HTTP ${response.status}`);
  return data;
};

window.apiPost = async function apiPost(path, body) {
  const response = await fetch(`${window.IMS_CONFIG.apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || `HTTP ${response.status}`);
  return data;
};
