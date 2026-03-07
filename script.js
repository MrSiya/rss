// Wait until the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // === 1. HIGHLIGHT ACTIVE NAV LINK ===
    const navLinks = document.querySelectorAll('.menu a');
    const currentPage = window.location.pathname.split("/").pop();

    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });

    // === 2. SCROLL TO TOP BUTTON ===
    const scrollBtn = document.createElement('button');
    scrollBtn.innerHTML = '↑';
    scrollBtn.id = 'scrollTopBtn';
    document.body.appendChild(scrollBtn);

    scrollBtn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        display: none;
        padding: 10px 15px;
        background: #000;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 999;
    `;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollBtn.style.display = 'block';
        } else {
            scrollBtn.style.display = 'none';
        }
    });

    scrollBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // === 3. FADE IN PAGE ON LOAD ===
    document.body.style.opacity = 0;
    document.body.style.transition = 'opacity 1s';
    setTimeout(() => {
        document.body.style.opacity = 1;
    }, 100);
});



// === 4. SCROLL REVEAL ANIMATION ===
const revealElements = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('show');
        }
    });
}, {
    threshold: 0.1
});

revealElements.forEach(el => observer.observe(el));

// This is where you added things
/* script.js - Robust drop-in for Rapreach site
   - addToOrder(name, price) is exposed for inline usage
   - creates a floating cart if #order-list isn't present
   - persists to localStorage
   - opens WhatsApp with order + customer info
   - logs startup info for debugging
*/

/* ---------- CONFIG ---------- */
const RAPREACH_WHATSAPP = "27677782904"; // <<-- REPLACE with your number (no + or spaces)
const STORAGE_KEY = "rapreach_order_v1";

/* ---------- STATE ---------- */
let order = []; // {name, price, qty}
let subtotal = 0;

/* ---------- UTIL ---------- */
const $ = sel => document.querySelector(sel);
const $all = sel => Array.from(document.querySelectorAll(sel));
const log = (...args) => console.log("[rapreach]", ...args);

/* ---------- INITIALIZE (safe) ---------- */
document.addEventListener("DOMContentLoaded", () => {
  log("script.js starting...");

  try {
    loadOrder();
    initNavHighlightSafe();
    initPageFadeSafe();
    initRevealSafe();
    setupOrderUIIfNeeded();
    renderOrder(); // will render to #order-list if present OR update floating UI
    log("init complete");
  } catch (err) {
    console.error("[rapreach] init error:", err);
  }
});

/* ---------- Public addToOrder preserved for inline onclicks ---------- */
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
    if (raw) order = JSON.parse(raw) || [];
    else order = [];
    log("loaded order", order);
  } catch (e) {
    console.warn("loadOrder error", e);
    order = [];
  }
}
function saveOrder() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch (e) {
    console.warn("saveOrder error", e);
  }
}

/* ---------- RENDER (either to existing #order-list or to floating cart) ---------- */
function renderOrder() {
  subtotal = 0;
  order.forEach(i => subtotal += i.price * i.qty);

  // If page has #order-list and #order-subtotal, render there
  const listEl = $("#order-list");
  const subtotalEl = $("#order-subtotal");
  if (listEl && subtotalEl) {
    listEl.innerHTML = "";
    if (order.length === 0) {
      listEl.innerHTML = `<p class="muted">Your order is empty.</p>`;
      subtotalEl.textContent = "R 0.00";
    } else {
      order.forEach((it, idx) => {
        const div = document.createElement("div");
        div.className = "order-item";
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";
        div.style.padding = "8px 6px";
        div.innerHTML = `
          <div>
            <strong>${escapeHtml(it.name)}</strong>
            <div style="font-size:12px;color:#bfbfbf">x${it.qty} · R ${it.price}</div>
          </div>
          <div>
            R ${(it.price * it.qty).toFixed(2)}
            <button data-remove="${idx}" style="margin-left:8px;background:transparent;border:none;color:#ff6b6b;cursor:pointer">Remove</button>
          </div>
        `;
        listEl.appendChild(div);
      });
      subtotalEl.textContent = "R " + subtotal.toFixed(2);
      // wire remove buttons
      listEl.querySelectorAll("[data-remove]").forEach(b => {
        b.addEventListener("click", () => {
          const idx = Number(b.getAttribute("data-remove"));
          order.splice(idx, 1);
          saveOrder();
          renderOrder();
        });
      });
    }
    updateFloatingCount();
    return;
  }

  // else show minimal floating UI (count + modal managed below)
  updateFloatingCount();
}

/* ---------- FLOATING CART UI (created if no #order-list) ---------- */
let floatingCreated = false;
function setupOrderUIIfNeeded() {
  if (floatingCreated) return;
  // create floating button + modal (only if no visible #order-list)
  if (!$("#order-list")) {
    createFloatingCart();
    floatingCreated = true;
  } else {
    // still create count badge for visibility if page has no explicit preview
    createFloatingCart(); floatingCreated = true;
  }
}

function createFloatingCart() {
  // avoid duplicate
  if ($("#rapreach-cart-btn")) return;

  // floating button
  const btn = document.createElement("button");
  btn.id = "rapreach-cart-btn";
  btn.title = "Open Cart";
  btn.style.cssText = "position:fixed;right:18px;bottom:80px;width:56px;height:56px;border-radius:50%;background:#00c07b;color:#fff;border:none;cursor:pointer;z-index:9999;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 8px 24px rgba(0,0,0,0.4)";
  btn.innerText = "🛒";
  document.body.appendChild(btn);

  // count badge
  const badge = document.createElement("span");
  badge.id = "rapreach-cart-count";
  badge.style.cssText = "position:absolute;top:-8px;right:-8px;background:#ff4d4d;color:#fff;border-radius:50%;padding:4px 7px;font-size:12px;font-weight:700";
  btn.appendChild(badge);

  // modal overlay
  const overlay = document.createElement("div");
  overlay.id = "rapreach-cart-modal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:10000;";
  overlay.innerHTML = `
    <div style="width:92%;max-width:480px;background:#0f0f0f;padding:18px;border-radius:10px;color:#fff;">
      <h3 style="margin-top:0">Your Order</h3>
      <div id="rapreach-cart-contents" style="max-height:320px;overflow:auto;margin-bottom:12px;"></div>
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

  // event wiring
  btn.addEventListener("click", () => { overlay.style.display = "flex"; renderFloatingContents(); });
  $("#rapreach-close").addEventListener("click", () => overlay.style.display = "none");
  $("#rapreach-clear").addEventListener("click", () => { if(confirm("Clear order?")) { order=[]; saveOrder(); renderOrder(); renderFloatingContents(); }});
  $("#rapreach-checkout").addEventListener("click", () => {
    overlay.style.display = "none";
    // show confirm overlay if exists on page
    const conf = document.querySelector(".confirm-overlay");
    if (conf) conf.style.display = "flex";
    else openQuickWhatsApp(); // fallback
  });

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

  // remove button handlers
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

/* ---------- NAV HIGHLIGHT (safe) ---------- */
function initNavHighlightSafe() {
  try {
    const current = window.location.pathname.split("/").pop() || "index.html";
    $all(".menu a, a.nav-link, .nav .menu a").forEach(a => {
      const href = a.getAttribute("href");
      if (!href) return;
      const hrefFile = href.split("/").pop().split("?")[0].split("#")[0];
      if (hrefFile === current) a.classList.add("active");
      else a.classList.remove("active");
    });
  } catch (e) {}
}

/* ---------- PAGE FADE ---------- */
function initPageFadeSafe() {
  try {
    document.body.style.opacity = 0;
    document.body.style.transition = "opacity 360ms ease";
    requestAnimationFrame(()=>document.body.style.opacity = 1);
  } catch (e) {}
}

/* ---------- REVEAL ON SCROLL ---------- */
function initRevealSafe() {
  try {
    const els = document.querySelectorAll(".reveal");
    if (!els || els.length === 0) return;
    const obs = new IntersectionObserver(entries=>{
      entries.forEach(en => { if (en.isIntersecting) en.target.classList.add("show"); });
    }, { threshold: 0.12 });
    els.forEach(el=>obs.observe(el));
  } catch(e){}
}

/* ---------- CONFIRM POPUP HELPERS (optional) ---------- */
window.openConfirmPage = function() {
  if (!order || order.length === 0) { alert("Your order is empty!"); return; }
  const overlay = document.querySelector(".confirm-overlay");
  if (!overlay) { openQuickWhatsApp(); return; }
  overlay.style.display = "flex";
};
window.closeConfirmPage = function() {
  const overlay = document.querySelector(".confirm-overlay");
  if (overlay) overlay.style.display = "none";
};

/* ---------- WHATSAPP ORDER BUILD & SEND ---------- */
function buildWhatsAppPayload(name, phone, email) {
  // group items
  const grouped = {};
  order.forEach(it => {
    const key = `${it.name}||${it.price}`;
    if (!grouped[key]) grouped[key] = { name: it.name, price: it.price, qty: 0 };
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
    const name = nameEl ? nameEl.value.trim() : "";
    const phone = phoneEl ? phoneEl.value.trim() : "";
    const email = emailEl ? emailEl.value.trim() : "";
    if (!name) { alert("Please enter your name."); if (nameEl) nameEl.focus(); return; }

    const { text } = buildWhatsAppPayload(name, phone, email);
    const url = `https://wa.me/${RAPREACH_WHATSAPP}?text=${text}`;
    window.open(url, "_blank");
 // you added this 2026/03/07
    if (!name) { alert("Please enter your name."); if (nameEl) nameEl.focus(); return; }
    // after sending, clear cart
    order = [];
    saveOrder();
    renderOrder();
    // also update floating modal if open
    const modal = $("#rapreach-cart-modal");
    if (modal) modal.style.display = "none";
    closeConfirmPage();
  } catch (e) {
    console.error("sendOrder error", e);
    alert("Could not send order. Try again.");
  }
};

function openQuickWhatsApp() {
  const name = "Customer";
  const { text } = buildWhatsAppPayload(name, "", "");
  window.open(`https://wa.me/${RAPREACH_WHATSAPP}?text=${text}`, "_blank");
}

/* ---------- small helpers ---------- */
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

/* ---------- tiny toast for feedback ---------- */
function flashMiniToast(msg) {
  try {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;bottom:150px;right:18px;background:#111;color:#fff;padding:10px 12px;border-radius:8px;z-index:99999;box-shadow:0 8px 20px rgba(0,0,0,0.6)";
    document.body.appendChild(t);
    setTimeout(()=> t.style.opacity = "0", 1400);
    setTimeout(()=> t.remove(), 1800);
  } catch(e){}
}

/* ---------- expose quick debug helper ---------- */
window.__rapreach_debug = {
  orderRef: () => order,
  subtotal: () => subtotal,
  clearStorage: () => { localStorage.removeItem(STORAGE_KEY); order=[]; saveOrder(); renderOrder(); }
};


/* */
// Category filtering
const categoryBtns = document.querySelectorAll(".category-btn");
const products = document.querySelectorAll(".product-card");

categoryBtns.forEach(btn => {
    btn.addEventListener("click", () => {

        // Remove active highlight from all
        categoryBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const category = btn.getAttribute("data-category");

        products.forEach(product => {
            const productCategory = product.getAttribute("data-category");

            if (category === "all" || productCategory === category) {
                product.style.display = "block";
            } else {
                product.style.display = "none";
            }
        });

    });
});
