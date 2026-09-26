const SUPABASE_URL = "https://dcrugxgnnogyjpcbhwyx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_DjFrTzt2IE32Kp8gDHCjsQ_JCO57WtK";

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

navToggle?.addEventListener("click", () => {
  const isOpen = siteNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("nav-open", isOpen);
});

siteNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    siteNav.classList.remove("open");
    navToggle?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  });
});

const form = document.getElementById("booking-form");
const status = document.getElementById("form-status");

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = "form-status" + (type ? ` ${type}` : "");
}

function emptyToNull(value) {
  const trimmed = String(value || "").trim();
  return trimmed === "" ? null : trimmed;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);

  const payload = {
    full_name: String(formData.get("full_name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: emptyToNull(formData.get("phone")),
    instagram: emptyToNull(formData.get("instagram")),
    placement: String(formData.get("placement") || "").trim(),
    approx_size: String(formData.get("approx_size") || "").trim(),
    concept: String(formData.get("concept") || "").trim(),
    availability: String(formData.get("availability") || "").trim(),
    budget: emptyToNull(formData.get("budget")),
    preferred_contact: String(formData.get("preferred_contact") || "email"),
    terms_accepted: formData.get("terms_accepted") === "on"
  };

  submitButton.disabled = true;
  setStatus("Sending your tattoo request…");

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/booking_requests`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let detail = "";
      try {
        const errorBody = await response.json();
        detail = errorBody?.message ? ` ${errorBody.message}` : "";
      } catch {
        detail = "";
      }
      throw new Error(`Request failed (${response.status}).${detail}`);
    }

    form.reset();
    const emailRadio = form.querySelector('input[name="preferred_contact"][value="email"]');
    if (emailRadio) emailRadio.checked = true;
    setStatus("Request received. Annabella can review it from the studio database.", "success");
  } catch (error) {
    console.error(error);
    setStatus("Something went wrong sending the request. Please try again or use the Venue Ink link above.", "error");
  } finally {
    submitButton.disabled = false;
  }
});


window.addEventListener("resize", () => {
  if (window.innerWidth > 720) {
    siteNav?.classList.remove("open");
    navToggle?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  }
});
