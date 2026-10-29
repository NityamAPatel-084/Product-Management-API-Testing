const API_BASE = `${window.location.origin}/api/products`;

const $ = (selector) => document.querySelector(selector);
const responseBody = $("#response-body code");
const toast = $("#toast");
let toastTimer;

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function formatINR(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}

function setResponse({ method, url, status, body, networkError = false }) {
  $("#response-method").textContent = method;
  $("#response-method").className = `method ${methodClass(method)}`;
  $("#response-url").textContent = url;
  const statusEl = $("#response-status");
  statusEl.textContent = status;
  statusEl.className = `status-chip ${networkError ? "error" : status >= 200 && status < 300 ? "success" : "error"}`;
  responseBody.textContent = JSON.stringify(body, null, 2);
  $("#response-message").textContent = networkError
    ? "Could not reach the API. Check that the Express server is running."
    : status >= 200 && status < 300
      ? "Request completed successfully."
      : "The API returned an error response. See the body for details.";
  $(".response-dot").className = `response-dot ${networkError ? "bad" : status >= 200 && status < 300 ? "ok" : "bad"}`;
}

function methodClass(method) {
  return method === "POST" ? "post" : method === "PUT" ? "put" : method === "DELETE" ? "delete" : "get";
}

async function apiRequest(method, url, payload, { displayResponse = true } = {}) {
  const requestUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  const displayUrl = url.replace(window.location.origin, "");
  const options = { method, headers: {} };
  if (payload !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload);
  }

  const buttons = document.querySelectorAll("form button[type='submit']");
  buttons.forEach((button) => {
    button.disabled = true;
    button.dataset.originalText ||= button.textContent;
  });

  try {
    const response = await fetch(requestUrl, options);
    const raw = await response.text();
    let body;
    try { body = raw ? JSON.parse(raw) : null; }
    catch { body = raw; }
    if (displayResponse) {
      setResponse({ method, url: displayUrl, status: response.status, body });
      if (!response.ok) showToast(body?.message || `Request failed (${response.status})`, true);
      else showToast(`${method} request completed (${response.status}).`);
    }
    return { response, body };
  } catch (error) {
    if (displayResponse) {
      setResponse({
        method,
        url: displayUrl,
        status: "Network error",
        body: { message: "Unable to connect to the API.", detail: error.message },
        networkError: true
      });
      showToast("Could not connect. Is the Express server running?", true);
    }
    return { response: null, body: null };
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function getProductArray(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  return null;
}

async function refreshProducts(showMessage = false, displayResponse = true) {
  const result = await apiRequest("GET", "/api/products", undefined, { displayResponse });
  if (!result.response || !result.response.ok) {
    $("#api-status").textContent = "Offline";
    $("#api-status").className = "stat-value status-value offline";
    $("#last-checked").textContent = "Request failed";
    $("#product-rows").innerHTML = '<tr><td colspan="5" class="empty-state">Could not load products. Check your server and refresh.</td></tr>';
    $("#table-summary").textContent = "Inventory unavailable";
    $("#total-products").textContent = "—";
    $("#total-stock").textContent = "—";
    $("#inventory-value").textContent = "—";
    return;
  }

  const products = getProductArray(result.body);
  if (!products) {
    $("#product-rows").innerHTML = '<tr><td colspan="5" class="empty-state">The API response did not contain a product list.</td></tr>';
    return;
  }

  $("#api-status").textContent = "Online";
  $("#api-status").className = "stat-value status-value online";
  $("#last-checked").textContent = `Checked ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  $("#total-products").textContent = products.length.toLocaleString("en-IN");
  $("#total-stock").textContent = products.reduce((sum, product) => sum + Number(product.stock || 0), 0).toLocaleString("en-IN");
  const inventoryValue = products.reduce((sum, product) => sum + Number(product.price || 0) * Number(product.stock || 0), 0);
  $("#inventory-value").textContent = formatINR(inventoryValue);
  $("#table-summary").textContent = `${products.length} product${products.length === 1 ? "" : "s"} returned by the API`;

  if (!products.length) {
    $("#product-rows").innerHTML = '<tr><td colspan="5" class="empty-state">No products found. Use the POST form to create one.</td></tr>';
  } else {
    $("#product-rows").innerHTML = products.map((product) => {
      const initial = String(product.name || "?").trim().charAt(0).toUpperCase() || "?";
      return `<tr>
        <td><div class="product-name-cell"><span class="product-avatar">${escapeHtml(initial)}</span><span><span class="product-name">${escapeHtml(product.name)}</span><span class="product-description">${escapeHtml(product.description || "")}</span></span></div></td>
        <td class="price-cell">${formatINR(Number(product.price || 0))}</td>
        <td><span class="stock-pill">${Number(product.stock || 0)} units</span></td>
        <td><span class="id-chip">#${escapeHtml(product.id)}</span></td>
        <td><div class="row-actions"><button class="icon-button" type="button" data-action="edit" data-id="${escapeHtml(product.id)}" title="Load into update form">Edit</button><button class="icon-button" type="button" data-action="delete" data-id="${escapeHtml(product.id)}" title="Fill delete form">Delete</button></div></td>
      </tr>`;
    }).join("");
  }
  if (showMessage) showToast("Product list refreshed.");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function productPayload(form, prefix) {
  const data = new FormData(form);
  return {
    name: String(data.get("name") || "").trim(),
    description: String(data.get("description") || "").trim(),
    price: Number(data.get("price")),
    stock: Number(data.get("stock"))
  };
}

$("#get-all-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await refreshProducts(true);
});

$("#get-one-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#get-id").value.trim();
  if (!id) return;
  await apiRequest("GET", `/api/products/${encodeURIComponent(id)}`);
});

$("#create-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = await apiRequest("POST", "/api/products", productPayload(form));
  if (result.response?.ok) {
    form.reset();
    await refreshProducts(false, false);
  }
});

$("#update-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = $("#update-id").value.trim();
  if (!id) return;
  const result = await apiRequest("PUT", `/api/products/${encodeURIComponent(id)}`, productPayload(form));
  if (result.response?.ok) await refreshProducts(false, false);
});

$("#delete-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#delete-id").value.trim();
  if (!id) return;
  if (!window.confirm(`Delete product #${id}? This action cannot be undone.`)) return;
  const result = await apiRequest("DELETE", `/api/products/${encodeURIComponent(id)}`);
  if (result.response?.ok) {
    event.currentTarget.reset();
    await refreshProducts(false, false);
  }
});

$("#product-rows").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === "edit") {
    const row = button.closest("tr");
    const cells = row.querySelectorAll("td");
    $("#update-id").value = id;
    $("#update-name").value = row.querySelector(".product-name").textContent;
    $("#update-description").value = row.querySelector(".product-description").textContent;
    $("#update-price").value = cells[1].textContent.replace(/[^\d.]/g, "");
    $("#update-stock").value = cells[2].textContent.replace(/[^\d]/g, "");
    $("#update").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#update-name").focus({ preventScroll: true });
    showToast(`Product #${id} loaded into the update form.`);
  } else if (button.dataset.action === "delete") {
    $("#delete-id").value = id;
    $("#delete").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#delete-id").focus({ preventScroll: true });
    showToast(`Product #${id} loaded into the delete form.`);
  }
});

$("#refresh-products").addEventListener("click", () => refreshProducts(true));
$("#refresh-top").addEventListener("click", () => refreshProducts(true));

$("#copy-response").addEventListener("click", async () => {
  const text = responseBody.textContent;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Response JSON copied.");
  } catch {
    const range = document.createRange();
    range.selectNodeContents(responseBody);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    showToast("Clipboard access unavailable; response text selected.", true);
  }
});

$("#base-url").textContent = API_BASE;
$("#sidebar-api-url").textContent = `${window.location.host}/api/products`;
refreshProducts();
