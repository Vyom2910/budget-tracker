// ==========================================
// CONFIGURATION & INITIAL STATE
// ==========================================
const DEFAULT_CATEGORIES = [
  { key: "food", name: "Eating out", icon: "🍱", budget: 6000 },
  { key: "fruit", name: "Fruits", icon: "🍎", budget: 3000 },
  { key: "utilities", name: "Utilities", icon: "🧴", budget: 1000 },
  { key: "snacks", name: "Coffee & snacks", icon: "☕", budget: 1000 },
  { key: "shopping", name: "Shopping", icon: "🛍️", budget: 1000 },
  { key: "misc", name: "Miscellaneous", icon: "📦", budget: 1000 },
  { key: "transport", name: "Transport", icon: "🚶", budget: 500 }
];

const BUDGET = {
  income: 80000,
  pg: 21000,
  savings: 40000,
  flex: 5500
};

const KEY = "budgetos_simple_ocr";
let loadedState = JSON.parse(localStorage.getItem(KEY) || "null") || {};
let state = {
  transactions: loadedState.transactions || [],
  categories: (loadedState.categories && loadedState.categories.length) 
    ? loadedState.categories 
    : [...DEFAULT_CATEGORIES]
};

let files = [];
let editingId = null;

if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const FAILED_STATUS_KEYWORDS = [
  "failed",
  "declined",
  "unsuccessful",
  "cancelled",
  "canceled",
  "expired",
  "rejected",
  "reversed"
];

function isTransactionSuccessful(textBlock) {
  const lower = String(textBlock || "").toLowerCase();
  return !FAILED_STATUS_KEYWORDS.some(keyword => lower.includes(keyword));
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "tx_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 8);
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  renderAll();
}

function spent() {
  return state.transactions.reduce((a, t) => a + Number(t.amount || 0), 0);
}

function catTotal(k) {
  return state.transactions
    .filter(t => t.category === k)
    .reduce((a, t) => a + Number(t.amount || 0), 0);
}

function catName(k) {
  return state.categories.find(c => c.key === k)?.name || "Uncategorized";
}

function unc() {
  return state.transactions.filter(t => !t.category);
}

function dateValue(t) {
  return new Date(`${t.date || "1970-01-01"}T${time24(t.time || "00:00")}`).getTime();
}

function time24(x) {
  const m = String(x).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return "00:00";
  let h = +m[1];
  if (m[3] && m[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[3] && m[3].toUpperCase() === "AM" && h === 12) h = 0;
  return String(h).padStart(2, "0") + ":" + m[2];
}

function fmtDate(d) {
  return d
    ? new Date(d + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "Unknown";
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function isNoiseMerchant(str) {
  const l = String(str || "").toLowerCase().trim();
  if (!l || l.length < 2) return true;
  
  // Directly filter out header OCR variations
  if (/^h[i1l]st?[o0]r[y1]|hisory|histry|history$/i.test(l)) return true;
  
  const noiseWords = [
    "history", "hisory", "histry", "filter", "filters", "search", "check balance", "view details",
    "successful", "completed", "payment history", "transaction history",
    "home", "help", "support", "today", "yesterday", "paid to", "sent to"
  ];
  if (noiseWords.includes(l)) return true;
  if (/^\d{1,2}[\.:]\d{2}/.test(l)) return true;
  if (/^\d+$/.test(l)) return true;
  return false;
}

function isDateTimeLine(str) {
  if (!str) return false;
  return /\b\d{1,2}[\.:]\d{2}\s*(?:AM|PM)?\b/i.test(str) ||
         /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(str) ||
         /\b(?:Today|Yesterday)\b/i.test(str);
}

function cleanMerchantName(str) {
  if (!str) return "";
  let clean = String(str || "").trim();

  // Strip OCR prefixes like "5.8", "gi.", "gi. 8", "WwW", clocks, and leading digits
  clean = clean
    .replace(/^(?:5\.8|gi\.\s*\d*|www|ww|vvw|vw|gt\.|g1\.|g\.)\s*/i, "")
    .replace(/^\d{1,2}[\.:]\d{2}\s*/, "")
    .replace(/^\d+(\.\d+)?\s+/, "")
    .replace(/^(Paid\s+to|Paid\s+at|Sent\s+to|Payment\s+to|Paying|To|Transfer\s+to)[:\s]*/i, "");

  // Remove trailing amount numbers, hyphens, and system tokens
  clean = clean
    .replace(/[-\u2013\u2014\u2212]\s*[₹RsINRinr\?fF£tT~*§¤\$]?\s*\d+.*/gi, "")
    .replace(/\s*-\s*\d+\s*$/g, "")
    .replace(/(?:SUCCESSFUL|SUCCESS|COMPLETED|PAID|FAILED|PENDING|DEBITED|CREDITED|UPI\s*ID|REF|TXN|ORDER|UTR|IMPS|NEFT).*/gi, "")
    .replace(/[\?₹fF£tT~*§¤\$]/g, "")
    .replace(/[^\w\s&.-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (isNoiseMerchant(clean)) return "";
  return clean;
}

function extractDateTime(input) {
  let date = "";
  let time = "";

  const rawText = Array.isArray(input)
    ? input.map(w => (typeof w === "object" ? w.text || "" : String(w))).join(" ")
    : String(input || "");

  const cleanText = rawText.replace(/[,;]/g, " ");

  const timeMatch = cleanText.match(/\b(\d{1,2}[\.:]\d{2}\s*(?:AM|PM)?)\b/i);
  if (timeMatch) time = timeMatch[1].replace(/\./g, ":").replace(/\s+/g, "");

  const lowerText = cleanText.toLowerCase();
  const now = new Date();

  if (/\btoday\b/i.test(lowerText)) {
    date = now.toISOString().slice(0, 10);
  } else if (/\byesterday\b/i.test(lowerText)) {
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    date = yest.toISOString().slice(0, 10);
  }

  if (!date) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

    const dateMatch1 = cleanText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+(\d{2,4}))?\b/i);
    const dateMatch2 = cleanText.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{2,4}))?\b/i);

    let day, month, year = now.getFullYear();

    if (dateMatch1) {
      day = parseInt(dateMatch1[1], 10);
      month = monthNames.indexOf(dateMatch1[2].toLowerCase().slice(0, 3)) + 1;
      if (dateMatch1[3]) {
        year = parseInt(dateMatch1[3], 10);
        if (year < 100) year += 2000;
      }
    } else if (dateMatch2) {
      day = parseInt(dateMatch2[2], 10);
      month = monthNames.indexOf(dateMatch2[1].toLowerCase().slice(0, 3)) + 1;
      if (dateMatch2[3]) {
        year = parseInt(dateMatch2[3], 10);
        if (year < 100) year += 2000;
      }
    }

    if (day && month && day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  if (!date) date = now.toISOString().slice(0, 10);
  return { date, time };
}

// ==========================================
// RENDERERS
// ==========================================
function renderDashboard() {
  const s = spent();
  const actual = BUDGET.income - BUDGET.pg - s;
  const rem = Math.max(0, 19000 - s);

  if ($("#totalSpent")) $("#totalSpent").textContent = money(s);
  if ($("#spendRemaining")) $("#spendRemaining").textContent = money(rem);
  if ($("#actualSavings")) $("#actualSavings").textContent = money(actual);

  const p = Math.max(0, Math.min(100, (actual / BUDGET.savings) * 100));

  if ($("#saveBar")) $("#saveBar").style.width = p + "%";
  if ($("#saveStatus")) {
    $("#saveStatus").textContent = actual >= BUDGET.savings ? "ON TRACK" : "BEHIND";
    $("#saveStatus").style.color = actual >= BUDGET.savings ? "#91b66a" : "#df7777";
  }

  if ($("#monthLabel")) $("#monthLabel").textContent = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  if ($("#categories")) {
    $("#categories").innerHTML = state.categories.map(c => {
      const v = catTotal(c.key);
      const cp = Math.min(100, (v / (c.budget || 1)) * 100);
      return `
        <div class="category">
          <div class="icon">${c.icon}</div>
          <div class="name">${esc(c.name)}</div>
          <div class="value">${money(v)}</div>
          <div class="muted">of ${money(c.budget || 0)}</div>
          <div class="mini">
            <span style="width:${cp}%"></span>
          </div>
        </div>
      `;
    }).join("");
  }

  const u = unc();
  const banner = $("#uncatBanner");
  if (banner) {
    banner.textContent = u.length ? `${u.length} transaction${u.length === 1 ? " is" : "s are"} uncategorized. Tag them on the Transactions page.` : "";
    banner.classList.toggle("hidden", !u.length);
  }

  const rec = [...state.transactions].sort((a, b) => dateValue(b) - dateValue(a)).slice(0, 6);
  if ($("#recent")) {
    $("#recent").innerHTML = rec.length
      ? rec.map(t => `
        <div class="transaction-row">
          <div>
            <div class="merchant">${esc(t.merchant)}</div>
            <div class="muted">${fmtDate(t.date)} ${t.time ? ` • ${esc(t.time)}` : ""} • ${esc(catName(t.category))}</div>
          </div>
          <span class="tag">${esc(t.source || "Manual")}</span>
          <div class="amount">${money(t.amount)}</div>
        </div>
      `).join("")
      : `<div class="muted">No transactions yet.</div>`;
  }
}

function options(selected) {
  return `
    <option value="" ${!selected ? "selected" : ""}>Uncategorized</option>
    ${state.categories.map(c => `
      <option value="${c.key}" ${selected === c.key ? "selected" : ""}>
        ${c.icon} ${esc(c.name)}
      </option>
    `).join("")}
  `;
}

function handleAddCategory() {
  const name = prompt("Enter new category name:");
  if (!name || !name.trim()) return;

  const cleanName = name.trim();
  const key = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString(36);

  if (state.categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
    alert("A category with this name already exists.");
    return;
  }

  const icon = prompt(`Enter icon for "${cleanName}":`, "🏷️") || "🏷️";
  const budgetStr = prompt(`Enter monthly budget amount (₹):`, "1000");

  state.categories.push({
    key: key,
    name: cleanName,
    icon: icon.trim(),
    budget: Math.max(0, Number(budgetStr) || 0)
  });

  save();
}

function deleteCategory(catKey) {
  const categoryToDelete = state.categories.find(c => c.key === catKey);
  if (!categoryToDelete) return;

  if (!confirm(`Delete "${categoryToDelete.name}"? Transactions will be uncategorized.`)) return;

  state.transactions.forEach(tx => {
    if (tx.category === catKey) tx.category = "";
  });

  state.categories = state.categories.filter(c => c.key !== catKey);
  save();
}

function renderTransactions() {
  if (!$("#rows")) return;

  const list = [...state.transactions].sort((a, b) => dateValue(b) - dateValue(a));
  const totalAmount = list.reduce((a, t) => a + Number(t.amount || 0), 0);

  const summaryBarHtml = `
    <div class="transactions-summary-bar">
      <div>
        <span class="muted-label">Total Transactions</span>
        <strong>${list.length} transaction${list.length === 1 ? "" : "s"}</strong>
      </div>
      <div style="text-align:right;">
        <span class="muted-label">Total Spent</span>
        <strong class="total-spent-amount">${money(totalAmount)}</strong>
      </div>
    </div>
  `;

  const columns = [
    { key: "", name: "Uncategorized", icon: "📥" },
    ...state.categories.map(c => ({ key: c.key, name: c.name, icon: c.icon }))
  ];

  const boardHtml = `
    <div class="kanban-board">
      ${columns.map(col => {
        const colTx = list.filter(t => (col.key === "" ? !t.category : t.category === col.key));
        const colSum = colTx.reduce((a, t) => a + Number(t.amount || 0), 0);
        return `
          <div class="kanban-column" data-col-key="${col.key}">
            <div class="kanban-column-header">
              <div class="kanban-title">
                <span>${col.icon}</span>
                <strong>${esc(col.name)}</strong>
                <span class="kanban-badge">${colTx.length}</span>
              </div>
              <div class="kanban-header-right">
                <span class="kanban-col-sum">${money(colSum)}</span>
                ${col.key !== "" ? `<button class="delete-category-btn" data-cat-key="${col.key}">×</button>` : ""}
              </div>
            </div>
            <div class="kanban-cards-container">
              ${colTx.map(t => `
                <div class="kanban-card" draggable="true" data-card-id="${t.id}">
                  <div class="kanban-card-top">
                    <span class="kanban-merchant" data-edit="${t.id}">${esc(t.merchant)}</span>
                    <div class="kanban-card-actions">
                      <button class="edit-card-btn" data-edit="${t.id}">✏️</button>
                      <button class="delete-card-btn" data-del="${t.id}">×</button>
                    </div>
                  </div>
                  <div class="kanban-card-bottom">
                    <span class="kanban-date">${fmtDate(t.date)}${t.time ? ` • ${esc(t.time)}` : ""}</span>
                    <strong class="kanban-amount">${money(t.amount)}</strong>
                  </div>
                </div>
              `).join("")}
              ${colTx.length === 0 ? `<div class="kanban-empty">Drop items here</div>` : ""}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  $("#rows").innerHTML = summaryBarHtml + boardHtml;

  $$(".delete-card-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      state.transactions = state.transactions.filter(t => t.id !== btn.dataset.del);
      save();
    };
  });

  $$(".delete-category-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteCategory(btn.dataset.catKey);
    };
  });

  $$(".edit-card-btn, .kanban-merchant").forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      openModal(el.dataset.edit);
    };
  });

  attachKanbanDragListeners();
}

function attachKanbanDragListeners() {
  const cards = $$(".kanban-card");
  const columns = $$(".kanban-column");

  cards.forEach(card => {
    card.addEventListener("dragstart", (e) => {
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", card.dataset.cardId);
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
    });
  });

  columns.forEach(column => {
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      column.classList.add("drag-over");
    });

    column.addEventListener("dragleave", (e) => {
      if (!column.contains(e.relatedTarget)) {
        column.classList.remove("drag-over");
      }
    });

    column.addEventListener("drop", (e) => {
      e.preventDefault();
      column.classList.remove("drag-over");
      const cardId = e.dataTransfer.getData("text/plain");
      const targetCategory = column.dataset.colKey;
      const transaction = state.transactions.find(t => t.id === cardId);

      if (transaction && transaction.category !== targetCategory) {
        transaction.category = targetCategory;
        save();
      }
    });
  });
}

function renderBudget() {
  if (!$("#budgetTable")) return;

  const rows = state.categories.map(c => {
    const v = catTotal(c.key);
    return `
      <div class="budget-line">
        <strong>${c.icon} ${esc(c.name)}</strong>
        <span>${money(c.budget || 0)}</span>
        <span>${money(v)}</span>
        <span>${v <= (c.budget || 0) ? "On track" : "Over budget"}</span>
      </div>
    `;
  }).join("");

  $("#budgetTable").innerHTML = `
    <div class="budget-line head">
      <span>Category</span>
      <span>Budget</span>
      <span>Spent</span>
      <span>Status</span>
    </div>
    ${rows}
  `;
}

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderBudget();

  const n = unc().length;
  if ($("#uncatCount")) $("#uncatCount").textContent = n || "";
}

// ==========================================
// ROUTING & NAVIGATION
// ==========================================
const VALID_VIEWS = ["dashboard", "transactions", "upload", "budget"];

function getActiveViewFromHash() {
  const hash = window.location.hash.replace("#", "").trim();
  return VALID_VIEWS.includes(hash) ? hash : "dashboard";
}

function showView(v, updateHash = true) {
  const targetView = VALID_VIEWS.includes(v) ? v : "dashboard";

  $$(".view").forEach(x => x.classList.toggle("active", x.id === targetView));
  $$(".nav-item").forEach(x => x.classList.toggle("active", x.dataset.view === targetView));

  if ($("#pageTitle")) {
    $("#pageTitle").textContent = {
      dashboard: "Dashboard",
      transactions: "Transactions",
      upload: "Upload statement",
      budget: "Budget"
    }[targetView];
  }

  if (updateHash && window.location.hash !== `#${targetView}`) {
    history.pushState(null, "", `#${targetView}`);
  }

  window.scrollTo(0, 0);
}

$$(".nav-item").forEach(b => b.onclick = () => showView(b.dataset.view));
$$("[data-go]").forEach(b => b.onclick = () => showView(b.dataset.go));

window.addEventListener("popstate", () => showView(getActiveViewFromHash(), false));

// ==========================================
// MODALS
// ==========================================
if ($("#addExpenseBtn")) $("#addExpenseBtn").onclick = () => openModal();
if ($("#addCategoryBtn")) $("#addCategoryBtn").onclick = handleAddCategory;
if ($("#closeModal")) $("#closeModal").onclick = () => $("#modal").classList.add("hidden");

function openModal(editId = null) {
  if (editId) {
    editingId = editId;
    const t = state.transactions.find(x => x.id === editId);
    if (t) {
      if ($("#modalTitle")) $("#modalTitle").textContent = "Edit Expense";
      if ($("#mDate")) $("#mDate").value = t.date || new Date().toISOString().slice(0, 10);
      if ($("#mMerchant")) $("#mMerchant").value = t.merchant || "";
      if ($("#mAmount")) $("#mAmount").value = t.amount || "";
      if ($("#mCategory")) $("#mCategory").innerHTML = options(t.category || "");
    }
  } else {
    editingId = null;
    if ($("#modalTitle")) $("#modalTitle").textContent = "Add Expense";
    if ($("#mDate")) $("#mDate").value = new Date().toISOString().slice(0, 10);
    if ($("#mMerchant")) $("#mMerchant").value = "";
    if ($("#mAmount")) $("#mAmount").value = "";
    if ($("#mCategory")) $("#mCategory").innerHTML = options("");
  }
  if ($("#modal")) $("#modal").classList.remove("hidden");
}

if ($("#form")) {
  $("#form").onsubmit = e => {
    e.preventDefault();
    if (editingId) {
      const t = state.transactions.find(x => x.id === editingId);
      if (t) {
        t.date = $("#mDate").value;
        t.merchant = $("#mMerchant").value.trim();
        t.amount = +$("#mAmount").value;
        t.category = $("#mCategory").value;
      }
    } else {
      state.transactions.push({
        id: generateId(),
        date: $("#mDate").value,
        merchant: $("#mMerchant").value.trim(),
        amount: +$("#mAmount").value,
        category: $("#mCategory").value,
        time: "",
        source: "Manual"
      });
    }
    editingId = null;
    if ($("#modal")) $("#modal").classList.add("hidden");
    save();
  };
}

// ==========================================
// FILE HANDLERS
// ==========================================
function handleFiles(selectedFiles) {
  files = Array.from(selectedFiles);
  if ($("#previews")) {
    $("#previews").innerHTML = files.map((f, i) => `
      <div class="preview" style="display:inline-block;margin:6px;">
        <span style="font-size:0.8rem;">${esc(f.name)}</span>
      </div>
    `).join("");
  }
  if ($("#importBtn")) $("#importBtn").disabled = !files.length;
}

const fileInputEl = $("#fileInput");
if (fileInputEl) {
  fileInputEl.addEventListener("change", e => {
    if (e.target.files && e.target.files.length) handleFiles(e.target.files);
  });
}

if ($("#importBtn")) $("#importBtn").onclick = runOCR;

// ==========================================
// ACCURATE SCREENSHOT OCR PARSER
// ==========================================
async function parseImageFile(file) {
  if (typeof Tesseract === "undefined") return [];

  try {
    const result = await Tesseract.recognize(file, "eng", {
      logger: m => {
        if (m.status === "recognizing text" && $("#ocrProgressText")) {
          const pct = Math.round((m.progress || 0) * 100);
          $("#ocrProgressText").textContent = `Scanning ${esc(file.name)}: ${pct}%`;
        }
      }
    });

    const rawText = result?.data?.text || "";
    if (!rawText.trim()) return [];

    // Filter baseline noise lines across the document
    const rawLines = rawText.split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && !/^h[i1l]st?[o0]r[y1]$/i.test(l) && l.toLowerCase() !== "hisory");

    // 1. SEGMENT LINES INTO DISCRETE TRANSACTION BLOCKS
    const blocks = [];
    let currentBlock = [];

    for (const line of rawLines) {
      // Trigger new block boundary when encountering vendor markers or fresh dates
      const isBoundary = /^(Paid\s+to|Sent\s+to|Transfer\s+to|Paying|To|Received\s+from)/i.test(line) ||
                         /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/i.test(line) ||
                         /\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i.test(line);

      if (isBoundary && currentBlock.length > 0) {
        blocks.push(currentBlock.join("\n"));
        currentBlock = [];
      }
      currentBlock.push(line);
    }
    if (currentBlock.length) blocks.push(currentBlock.join("\n"));

    // 2. EXTRACT PROPERTIES WITHIN EACH ISOLATED BLOCK
    const parsedTransactions = [];

    for (const blockText of blocks) {
      if (!isTransactionSuccessful(blockText)) continue;

      // Extract amount scoped strictly to blockText
      const amtMatch = blockText.match(/(?:[-\u2013\u2014\u2212\u20B9₹Rs]\s*)?(\d+(?:\.\d{1,2})?)/i);
      if (!amtMatch) continue;

      const amt = parseFloat(amtMatch[1]);
      if (isNaN(amt) || amt <= 0 || amt > 1000000) continue;

      // Extract first valid merchant string inside blockText
      let merchant = "";
      const blockLines = blockText.split("\n");
      for (const line of blockLines) {
        const cleaned = cleanMerchantName(line);
        if (cleaned && !isNoiseMerchant(cleaned) && cleaned.length >= 2) {
          merchant = cleaned;
          break;
        }
      }

      if (!merchant) continue;

      // Extract date & time scoped strictly to blockText
      const dateTime = extractDateTime(blockText);

      parsedTransactions.push({
        id: generateId(),
        merchant: merchant,
        amount: amt,
        date: dateTime.date,
        time: dateTime.time,
        category: "",
        source: "Screenshot OCR"
      });
    }

    return parsedTransactions;
  } catch (err) {
    console.error("Block OCR error:", err);
    return [];
  }
}

// ==========================================
// UNIFIED IMPORT CONTROLLER
// ==========================================
async function runOCR() {
  if (!files.length) return;

  if ($("#importBtn")) $("#importBtn").disabled = true;
  if ($("#ocrProgressWrap")) $("#ocrProgressWrap").classList.remove("hidden");

  let added = 0;
  let skipped = 0;

  try {
    for (let i = 0; i < files.length; i++) {
      const imgTx = await parseImageFile(files[i]);
      for (const transaction of imgTx) {
        const duplicate = state.transactions.some(
          existing =>
            existing.date === transaction.date &&
            Math.abs(Number(existing.amount) - Number(transaction.amount)) < 0.01 &&
            String(existing.merchant).toLowerCase() === String(transaction.merchant).toLowerCase()
        );

        if (duplicate) {
          skipped++;
        } else {
          state.transactions.push(transaction);
          added++;
        }
      }
    }

    files = [];
    if ($("#fileInput")) $("#fileInput").value = "";
    if ($("#previews")) $("#previews").innerHTML = "";

    save();
    showView("transactions");
    alert(`${added} transaction${added === 1 ? "" : "s"} imported successfully.`);
  } catch (error) {
    console.error("Import error:", error);
    alert("An error occurred while reading the screenshot.");
  } finally {
    if ($("#importBtn")) $("#importBtn").disabled = !files.length;
    if ($("#ocrProgressWrap")) $("#ocrProgressWrap").classList.add("hidden");
  }
}

// ==========================================
// INITIALIZATION
// ==========================================
renderAll();
showView(getActiveViewFromHash(), true);