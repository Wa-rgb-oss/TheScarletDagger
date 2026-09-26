const ADMIN_API = "https://dcrugxgnnogyjpcbhwyx.supabase.co/functions/v1/scarlet-admin";

const pinScreen = document.getElementById("pin-screen");
const adminApp = document.getElementById("admin-app");
const pinDots = [...document.querySelectorAll("#pin-dots span")];
const pinMessage = document.getElementById("pin-message");
const keypad = document.getElementById("pin-keypad");
const deleteButton = document.getElementById("pin-delete");
const logoutButton = document.getElementById("admin-logout");
const requestList = document.getElementById("request-list");
const loadMessage = document.getElementById("admin-load-message");
const tabs = document.getElementById("admin-tabs");
const searchInput = document.getElementById("admin-search");
const modal = document.getElementById("request-modal");
const modalScrim = document.getElementById("modal-scrim");
const modalClose = document.getElementById("drawer-close");
const statusSelect = document.getElementById("drawer-status");

let pin = "";
let busy = false;
let sessionToken = "";
let requests = [];
let activeFilter = "all";
let activeRequestId = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderDots() {
  pinDots.forEach((dot, index) => dot.classList.toggle("filled", index < pin.length));
}

function resetPin(message = "6 DIGITS // AUTO SUBMIT", isError = false) {
  pin = "";
  renderDots();
  pinMessage.textContent = message;
  pinMessage.classList.toggle("error", isError);
}

async function api(action, payload = {}, token = sessionToken) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["x-admin-token"] = token;

  const response = await fetch(ADMIN_API, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const error = new Error(body.error || "Request failed.");
    error.status = response.status;
    throw error;
  }

  return body;
}

async function submitPin() {
  if (busy || pin.length !== 6) return;
  busy = true;
  pinMessage.classList.remove("error");
  pinMessage.textContent = "VERIFYING // HOLD";

  try {
    const result = await api("unlock", { pin }, "");
    sessionToken = result.token;
    pinScreen.classList.add("unlocking");
    setTimeout(() => showAdmin(), 220);
  } catch (error) {
    pinScreen.classList.add("pin-shake");
    setTimeout(() => pinScreen.classList.remove("pin-shake"), 430);
    resetPin(error.message || "INCORRECT PIN", true);
  } finally {
    busy = false;
  }
}

keypad?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-digit]");
  if (!button || busy || pin.length >= 6) return;
  pin += button.dataset.digit;
  pinMessage.classList.remove("error");
  pinMessage.textContent = "ENTER PASSCODE";
  renderDots();
  if (pin.length === 6) submitPin();
});

deleteButton?.addEventListener("click", () => {
  if (busy || !pin) return;
  pin = pin.slice(0, -1);
  renderDots();
  pinMessage.classList.remove("error");
  pinMessage.textContent = "ENTER PASSCODE";
});

document.addEventListener("keydown", (event) => {
  if (!adminApp.hidden) return;
  if (/^\d$/.test(event.key) && pin.length < 6 && !busy) {
    pin += event.key;
    renderDots();
    if (pin.length === 6) submitPin();
  }
  if (event.key === "Backspace" && pin.length && !busy) {
    pin = pin.slice(0, -1);
    renderDots();
  }
});

async function showAdmin() {
  pinScreen.hidden = true;
  adminApp.hidden = false;
  document.body.classList.add("admin-unlocked");
  await loadRequests();
}

function clearPrivateData() {
  requests = [];
  activeRequestId = null;
  requestList.innerHTML = "";
  loadMessage.textContent = "";
  searchInput.value = "";
  activeFilter = "all";
  tabs.querySelectorAll("button").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.filter === "all");
  });
  ["count-new", "count-reviewing", "count-contacted", "count-booked"].forEach((id) => {
    document.getElementById(id).textContent = "0";
  });
  [
    "drawer-name","drawer-date","drawer-placement","drawer-size",
    "drawer-availability","drawer-budget","drawer-concept","drawer-email",
    "drawer-phone","drawer-instagram","drawer-preferred"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
  document.getElementById("drawer-actions").innerHTML = "";
}

function returnToPin(message = "SESSION LOCKED") {
  sessionToken = "";
  closeRequest();
  clearPrivateData();
  adminApp.hidden = true;
  pinScreen.hidden = false;
  pinScreen.classList.remove("unlocking");
  document.body.classList.remove("admin-unlocked");
  window.scrollTo(0, 0);
  resetPin(message, false);
}

async function loadRequests() {
  loadMessage.textContent = "LOADING REQUESTS // PLEASE HOLD";
  requestList.innerHTML = "";

  try {
    const result = await api("list");
    requests = result.requests || [];
    loadMessage.textContent = "";
    renderStats();
    renderRequests();
  } catch (error) {
    if (error.status === 401) {
      returnToPin("SESSION EXPIRED // ENTER PASSCODE");
      return;
    }
    loadMessage.textContent = error.message || "UNABLE TO LOAD REQUESTS";
  }
}

function renderStats() {
  const count = (status) => requests.filter((request) => request.status === status).length;
  document.getElementById("count-new").textContent = count("new");
  document.getElementById("count-reviewing").textContent = count("reviewing");
  document.getElementById("count-contacted").textContent = count("contacted");
  document.getElementById("count-booked").textContent = count("booked");
}

function filteredRequests() {
  const query = searchInput.value.trim().toLowerCase();

  return requests.filter((request) => {
    if (activeFilter !== "all" && request.status !== activeFilter) return false;
    if (!query) return true;

    const haystack = [
      request.full_name,
      request.email,
      request.phone,
      request.instagram,
      request.placement,
      request.approx_size,
      request.concept,
      request.availability,
      request.budget,
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });
}

function renderRequests() {
  const visible = filteredRequests();

  if (!visible.length) {
    requestList.innerHTML = `
      <div class="admin-empty">
        <strong>NO SIGNAL.</strong>
        <span>No requests match this view.</span>
      </div>
    `;
    return;
  }

  requestList.innerHTML = visible.map((request) => `
    <button class="request-card" type="button" data-request-id="${request.id}">
      <div class="request-card-top">
        <span class="status-chip status-${escapeHtml(request.status)}">${escapeHtml(request.status)}</span>
        <time>${escapeHtml(formatDate(request.created_at))}</time>
      </div>
      <h2>${escapeHtml(request.full_name)}</h2>
      <div class="request-card-meta">
        <span>${escapeHtml(request.placement)}</span>
        <span>${escapeHtml(request.approx_size)}</span>
      </div>
      <p>${escapeHtml(request.concept)}</p>
      <div class="request-card-bottom">
        <span>${escapeHtml(request.preferred_contact || "email").toUpperCase()}</span>
        <b>OPEN FILE ↗</b>
      </div>
    </button>
  `).join("");
}

tabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  tabs.querySelectorAll("button").forEach((tab) => tab.classList.toggle("active", tab === button));
  renderRequests();
});

searchInput?.addEventListener("input", renderRequests);

requestList?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-request-id]");
  if (!card) return;
  openRequest(card.dataset.requestId);
});

function setText(id, value, fallback = "—") {
  document.getElementById(id).textContent = value || fallback;
}

function openRequest(id) {
  const request = requests.find((item) => item.id === id);
  if (!request) return;

  activeRequestId = id;
  setText("drawer-name", request.full_name);
  setText("drawer-date", "SUBMITTED // " + formatDate(request.created_at));
  setText("drawer-placement", request.placement);
  setText("drawer-size", request.approx_size);
  setText("drawer-availability", request.availability);
  setText("drawer-budget", request.budget);
  setText("drawer-concept", request.concept);
  setText("drawer-email", request.email);
  setText("drawer-phone", request.phone);
  setText("drawer-instagram", request.instagram);
  setText("drawer-preferred", (request.preferred_contact || "email").toUpperCase());

  statusSelect.value = request.status;

  const actions = [];
  if (request.email) actions.push(`<a href="mailto:${encodeURIComponent(request.email)}">EMAIL CLIENT ↗</a>`);
  if (request.phone) actions.push(`<a href="tel:${escapeHtml(request.phone)}">CALL CLIENT ↗</a>`);
  if (request.instagram) {
    const handle = String(request.instagram).replace(/^@/, "");
    actions.push(`<a href="https://instagram.com/${encodeURIComponent(handle)}" target="_blank" rel="noopener noreferrer">INSTAGRAM ↗</a>`);
  }
  document.getElementById("drawer-actions").innerHTML = actions.join("");

  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeRequest() {
  modal.hidden = true;
  activeRequestId = null;
  document.body.classList.remove("modal-open");
}

modalScrim?.addEventListener("click", closeRequest);
modalClose?.addEventListener("click", closeRequest);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeRequest();
});

statusSelect?.addEventListener("change", async () => {
  if (!activeRequestId) return;

  const newStatus = statusSelect.value;
  statusSelect.disabled = true;

  try {
    await api("update_status", { id: activeRequestId, status: newStatus });
    const request = requests.find((item) => item.id === activeRequestId);
    if (request) request.status = newStatus;
    renderStats();
    renderRequests();
  } catch (error) {
    if (error.status === 401) {
      closeRequest();
      returnToPin("SESSION EXPIRED // ENTER PASSCODE");
      return;
    }
    alert(error.message || "Unable to update request.");
    const request = requests.find((item) => item.id === activeRequestId);
    if (request) statusSelect.value = request.status;
  } finally {
    statusSelect.disabled = false;
  }
});

logoutButton?.addEventListener("click", async () => {
  try {
    if (sessionToken) await api("logout");
  } catch {
    // Lock locally even if the server request fails.
  }
  closeRequest();
  returnToPin("ADMIN LOCKED // ENTER PASSCODE");
});

(function boot() {
  clearPrivateData();
  adminApp.hidden = true;
  pinScreen.hidden = false;
  document.body.classList.remove("admin-unlocked");
  renderDots();
  window.scrollTo(0, 0);
})();