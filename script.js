/* ---------- CONFIG ---------- */
const RAPREACH_WHATSAPP = "27677782904"; // <<-- Replace with your WhatsApp number (no + or spaces)
const STORAGE_KEY = "rapreach_order_v1";

/* ---------- STATE ---------- */
let order = []; // {name, price, qty}
let subtotal = 0;

/* ---------- UTIL ---------- */
const $ = sel => document.querySelector(sel);
const $all = sel => Array.from(document.querySelectorAll(sel));
const log = (...args) => console.log("[rapreach]", ...args);

/* ---------- INITIALIZE ---------- */
document.addEventListener("DOMContentLoaded", () => {
  log("script.js starting...");
  try {
    loadOrder();
    renderOrder();
    setupOrderUIIfNeeded();
    log("init complete");
  } catch (err) {
    console.error("[rapreach] init error:", err);
  }
});

/* ---------- ADD TO ORDER ---------- */
window.addToOrder = function(name, price) {
  price = Number(price) || 0;
  const found = order.find(i => i.name === name && i.price === price);
  if (found) found.qty++;
  else order.push({ name, price, qty: 1 });
  saveOrder();
  renderOrder();
  flashMiniToast(`${name} added`);
};

/* ---------- STORAGE ---------- */
function loadOrder() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    order = raw ? JSON.parse(raw) || [] : [];
    log("loaded order", order);
  } catch (e) {
    console.warn("loadOrder error", e);
    order = [];
  }
}
function saveOrder() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); }
  catch (e) { console.warn("saveOrder error", e); }
}

/* ---------- RENDER ORDER ---------- */
function renderOrder() {
  subtotal = order.reduce((sum,i)=>sum+i.price*i.qty,0);
  const listEl = $("#order-list");
  const subtotalEl = $("#order-subtotal");
  if (listEl && subtotalEl) {
    listEl.innerHTML = "";
    if (order.length === 0) listEl.innerHTML = `<p class="muted">Your order is empty.</p>`, subtotalEl.textContent = "R 0.00";
    else {
      order.forEach((it, idx) => {
        const div = document.createElement("div");
        div.className = "order-item";
        div.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:8px 6px";
        div.innerHTML = `
          <div>
            <strong>${escapeHtml(it.name)}</strong>
            <div style="font-size:12px;color:#bfbfbf">x${it.qty} · R ${it.price}</div>
          </div>
          <div>
            R ${(it.price*it.qty).toFixed(2)}
            <button data-remove="${idx}" style="margin-left:8px;background:transparent;border:none;color:#ff6b6b;cursor:pointer">Remove</button>
          </div>
        `;
        listEl.appendChild(div);
      });
      subtotalEl.textContent = "R " + subtotal.toFixed(2);
      listEl.querySelectorAll("[data-remove]").forEach(b => {
        b.addEventListener("click", () => {
          const idx = Number(b.getAttribute("data-remove"));
          order.splice(idx,1);
          saveOrder();
          renderOrder();
        });
      });
    }
    updateFloatingCount();
    return;
  }
  updateFloatingCount();
}

/* ---------- FLOATING CART ---------- */
let floatingCreated = false;
function setupOrderUIIfNeeded() {
  if (floatingCreated) return;
  createFloatingCart();
  floatingCreated = true;
}

function createFloatingCart() {
  if ($("#rapreach-cart-btn")) return;

  // Floating cart button
  const btn = document.createElement("button");
  btn.id = "rapreach-cart-btn";
  btn.title = "Open Cart";
  btn.style.cssText = "position:fixed;right:18px;bottom:80px;width:56px;height:56px;border-radius:50%;background:#00c07b;color:#fff;border:none;cursor:pointer;z-index:9999;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 8px 24px rgba(0,0,0,0.4)";
  btn.innerText = "🛒";
  document.body.appendChild(btn);

  // Badge
  const badge = document.createElement("span");
  badge.id = "rapreach-cart-count";
  badge.style.cssText = "position:absolute;top:-8px;right:-8px;background:#ff4d4d;color:#fff;border-radius:50%;padding:4px 7px;font-size:12px;font-weight:700";
  btn.appendChild(badge);

  // Modal overlay
  const overlay = document.createElement("div");
  overlay.id = "rapreach-cart-modal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:10000;";
  overlay.innerHTML = `
    <div style="width:92%;max-width:480px;background:#0f0f0f;padding:18px;border-radius:10px;color:#fff;">
      <h3 style="margin-top:0">Your Order</h3>
      <div id="rapreach-cart-contents" style="max-height:220px;overflow:auto;margin-bottom:12px;"></div>

      <!-- Customer Inputs -->
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
        <input type="text" id="c-name" placeholder="Your Name" style="padding:8px;border-radius:6px;border:none;">
        <input type="tel" id="c-phone" placeholder="Phone Number" style="padding:8px;border-radius:6px;border:none;">
        <input type="email" id="c-email" placeholder="Email Address" style="padding:8px;border-radius:6px;border:none;">
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <strong>Subtotal</strong><strong id="rapreach-cart-sub">R 0.00</strong>
      </div>
      <div style="display:flex;gap:8px">
        <button id="rapreach-clear" style="flex:1;padding:10px;border-radius:8px;border:none;background:#ff6b6b;color:#000;font-weight:700">Clear</button>
        <button id="rapreach-checkout" style="flex:1;padding:10px;border-radius:8px;border:none;background:#25d366;color:#000;font-weight:700">Checkout</button>
      </div>
      <div style="text-align:right;margin-top:8px"><button id="rapreach-close" style="background:none;border:none;color:#bbb">Close</button></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Event wiring
  btn.addEventListener("click", () => { overlay.style.display = "flex"; renderFloatingContents(); });
  $("#rapreach-close").addEventListener("click", () => overlay.style.display = "none");
  $("#rapreach-clear").addEventListener("click", () => { 
    if(confirm("Clear order?")) { order=[]; saveOrder(); renderOrder(); renderFloatingContents(); } 
  });
  $("#rapreach-checkout").addEventListener("click", sendOrder);

  updateFloatingCount();
}

function renderFloatingContents() {
  const el = $("#rapreach-cart-contents");
  const sub = $("#rapreach-cart-sub");
  el.innerHTML = "";
  let sum = 0;
  if (!order || order.length === 0) {
    el.innerHTML = "<p style='color:#bbb'>No items in cart.</p>";
    sub.textContent = "R 0.00";
    return;
  }
  order.forEach((it, idx) => {
    sum += it.price * it.qty;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03)";
    row.innerHTML = `<div><strong>${escapeHtml(it.name)}</strong><div style="font-size:12px;color:#bfbfbf">x${it.qty} · R ${it.price}</div></div><div>R ${(it.price*it.qty).toFixed(2)} <button data-ridx="${idx}" style="border:none;background:none;color:#ff6b6b;cursor:pointer;margin-left:8px">Remove</button></div>`;
    el.appendChild(row);
  });
  sub.textContent = "R " + sum.toFixed(2);

  // Remove buttons
  el.querySelectorAll("[data-ridx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-ridx"));
      order.splice(i,1);
      saveOrder();
      renderOrder();
      renderFloatingContents();
    });
  });
}

function updateFloatingCount() {
  const badge = $("#rapreach-cart-count");
  if (!badge) return;
  const qty = order.reduce((s,i)=>s+i.qty,0);
  badge.textContent = qty > 0 ? qty : "";
}

/* ---------- WHATSAPP ORDER ---------- */
function buildWhatsAppPayload(name, phone, email) {
  const grouped = {};
  order.forEach(it => {
    const key = `${it.name}||${it.price}`;
    if (!grouped[key]) grouped[key] = { name: it.name, price: it.price, qty:0 };
    grouped[key].qty += it.qty;
  });
  let total = 0;
  let text = `Hello Rapreach! I would like to place an order:%0A%0A`;
  Object.values(grouped).forEach(g => {
    const lineTotal = g.price * g.qty;
    total += lineTotal;
    text += `• ${g.name} x${g.qty} — R ${lineTotal.toFixed(2)}%0A`;
  });
  text += `%0ASubtotal: R ${total.toFixed(2)}%0A%0A`;
  text += `Customer: ${encodeURIComponent(name)}%0A`;
  if (phone) text += `Phone: ${encodeURIComponent(phone)}%0A`;
  if (email) text += `Email: ${encodeURIComponent(email)}%0A`;
  return { text, total };
}

window.sendOrder = function() {
  try {
    const nameEl = $("#c-name");
    const phoneEl = $("#c-phone");
    const emailEl = $("#c-email");
    const name = nameEl?.value.trim() || "";
    const phone = phoneEl?.value.trim() || "";
    const email = emailEl?.value.trim() || "";
    if (!name) { alert("Please enter your name."); nameEl?.focus(); return; }

    const { text } = buildWhatsAppPayload(name, phone, email);
    window.open(`https://wa.me/${RAPREACH_WHATSAPP}?text=${text}`, "_blank");

    // Clear cart after sending
    order = [];
    saveOrder();
    renderOrder();
    $("#rapreach-cart-modal").style.display = "none";
  } catch (e) {
    console.error("sendOrder error", e);
    alert("Could not send order. Try again.");
  }
};

/* ---------- HELPERS ---------- */
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

function flashMiniToast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;bottom:150px;right:18px;background:#111;color:#fff;padding:10px 12px;border-radius:8px;z-index:99999;box-shadow:0 8px 20px rgba(0,0,0,0.6)";
  document.body.appendChild(t);
  setTimeout(()=> t.style.opacity = "0", 1400);
  setTimeout(()=> t.remove(), 1800);
}