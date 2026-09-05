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
  if (FAILED_STATUS_KEYWORDS.some(keyword => lower.includes(keyword))) {
    return false;
  }
  return true;
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

// ==========================================
// RENDERERS: DASHBOARD & BUDGET
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

  const weekBudget = 4375;
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const ws = state.transactions
    .filter(t => new Date((t.date || "1970-01-01") + "T12:00:00") >= monday)
    .reduce((a, t) => a + Number(t.amount || 0), 0);

  const wl = Math.max(0, weekBudget - ws);
  if ($("#weekLeft")) $("#weekLeft").textContent = money(wl);
  if ($("#weekBar")) $("#weekBar").style.width = Math.min(100, (ws / weekBudget) * 100) + "%";
  if ($("#weekText")) {
    $("#weekText").textContent = ws <= weekBudget
      ? `You have ${money(wl)} left in the suggested weekly pace.`
      : `You are ${money(ws - weekBudget)} over this week's pace.`;
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
  const name = prompt("Enter new category name (e.g. Health, Subscriptions):");
  if (!name || !name.trim()) return;

  const cleanName = name.trim();
  const key = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString(36);

  if (state.categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
    alert("A category with this name already exists.");
    return;
  }

  const icon = prompt(`Enter an icon/emoji for "${cleanName}":`, "🏷️") || "🏷️";
  const budgetStr = prompt(`Enter monthly budget amount for "${cleanName}" (₹):`, "1000");
  const budget = Math.max(0, Number(budgetStr) || 0);

  state.categories.push({
    key: key,
    name: cleanName,
    icon: icon.trim(),
    budget: budget
  });

  save();
}

function deleteCategory(catKey) {
  const categoryToDelete = state.categories.find(c => c.key === catKey);
  if (!categoryToDelete) return;

  const confirmed = confirm(`Are you sure you want to delete "${categoryToDelete.name}"?\nTransactions will be moved to Uncategorized.`);
  if (!confirmed) return;

  state.transactions.forEach(tx => {
    if (tx.category === catKey) {
      tx.category = "";
    }
  });

  state.categories = state.categories.filter(c => c.key !== catKey);
  save();
}

// ==========================================
// RENDERERS: TRANSACTIONS & KANBAN
// ==========================================
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
        const isUncategorized = col.key === "";
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
                ${!isUncategorized ? `
                  <button class="delete-category-btn" data-cat-key="${col.key}" title="Delete Category">×</button>
                ` : ""}
              </div>
            </div>
            <div class="kanban-cards-container">
              ${colTx.map(t => `
                <div class="kanban-card" draggable="true" data-card-id="${t.id}">
                  <div class="kanban-card-top">
                    <span class="kanban-merchant" title="Click to edit" data-edit="${t.id}">${esc(t.merchant)}</span>
                    <div class="kanban-card-actions">
                      <button class="edit-card-btn" data-edit="${t.id}" title="Edit transaction">✏️</button>
                      <button class="delete-card-btn" data-del="${t.id}" title="Delete transaction">×</button>
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

  $$(".edit-card-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openModal(btn.dataset.edit);
    };
  });

  $$(".kanban-merchant").forEach(el => {
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
      e.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
    });
  });

  columns.forEach(column => {
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
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
    <div class="budget-line">
      <strong>⚪ Uncategorized</strong>
      <span>—</span>
      <span>${money(unc().reduce((a, t) => a + Number(t.amount || 0), 0))}</span>
      <span>Tag manually</span>
    </div>
    <div class="budget-line">
      <strong>Flex / buffer</strong>
      <span>${money(BUDGET.flex)}</span>
      <span>—</span>
      <span>Available buffer</span>
    </div>
    <div class="budget-line budget-total">
      <strong>Variable spending</strong>
      <span>₹19,000</span>
      <span>${money(spent())}</span>
      <span>${spent() <= 19000 ? "Within limit" : "Over limit"}</span>
    </div>
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
  const contentArea = $(".content");
  if (contentArea) contentArea.scrollTop = 0;
}

$$(".nav-item").forEach(b => b.onclick = () => showView(b.dataset.view));
$$("[data-go]").forEach(b => b.onclick = () => showView(b.dataset.go));

window.addEventListener("popstate", () => {
  showView(getActiveViewFromHash(), false);
});

const sidebar = $("#sidebar");
const sidebarToggle = $("#sidebarToggle");
if (sidebarToggle && sidebar) {
  sidebarToggle.onclick = () => {
    sidebar.classList.toggle("collapsed");
    sidebarToggle.textContent = sidebar.classList.contains("collapsed") ? "»" : "«";
  };
}

// ==========================================
// MODALS & EXPENSE FORM
// ==========================================
if ($("#addExpenseBtn")) $("#addExpenseBtn").onclick = () => openModal();
if ($("#addCategoryBtn")) $("#addCategoryBtn").onclick = handleAddCategory;
if ($("#quickAdd")) $("#quickAdd").onclick = () => openModal();
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
// FILE SELECTION & UPLOAD HANDLERS
// ==========================================
function handleFiles(selectedFiles) {
  files = Array.from(selectedFiles);
  if ($("#previews")) {
    $("#previews").innerHTML = files.map((f, i) => {
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        return `
          <div class="preview pdf-preview" style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;border:1px solid #ccc;border-radius:8px;background:#f9f9f9;width:120px;height:120px;text-align:center;margin:6px;">
            <span style="font-size:2.2rem;">📄</span>
            <span style="font-size:0.75rem;word-break:break-all;margin-top:6px;font-weight:600;color:#333;">${esc(f.name)}</span>
          </div>
        `;
      }
      return `
        <div class="preview" style="display:inline-block;margin:6px;">
          <img src="${URL.createObjectURL(f)}" alt="Screenshot ${i + 1}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #ccc;">
        </div>
      `;
    }).join("");
  }
  if ($("#importBtn")) $("#importBtn").disabled = !files.length;
}

const dropzoneEl = $("#dropzone") || $(".dropzone");
const fileInputEl = $("#fileInput");
const browseBtnEl = $("#browseBtn");

if (dropzoneEl) {
  dropzoneEl.addEventListener("click", (e) => {
    if (e.target !== fileInputEl && fileInputEl) {
      fileInputEl.click();
    }
  });

  dropzoneEl.addEventListener("dragover", e => {
    e.preventDefault();
    dropzoneEl.classList.add("dragover");
  });

  dropzoneEl.addEventListener("dragleave", () => {
    dropzoneEl.classList.remove("dragover");
  });

  dropzoneEl.addEventListener("drop", e => {
    e.preventDefault();
    dropzoneEl.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  });
}

if (browseBtnEl) {
  browseBtnEl.addEventListener("click", (e) => {
    e.stopPropagation();
    if (fileInputEl) fileInputEl.click();
  });
}

if (fileInputEl) {
  fileInputEl.addEventListener("change", e => {
    if (e.target.files && e.target.files.length) {
      handleFiles(e.target.files);
    }
  });
}

if ($("#importBtn")) $("#importBtn").onclick = runOCR;

// ==========================================
// OCR & PARSING LOGIC (PDF + SCREENSHOT IMAGES)
// ==========================================
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function buildLines(words) {
  const usable = (words || [])
    .filter(w => w.text && w.text.trim())
    .sort((a, b) => {
      const ay = (a.bbox.y0 + a.bbox.y1) / 2;
      const by = (b.bbox.y0 + b.bbox.y1) / 2;
      return ay - by || a.bbox.x0 - b.bbox.x0;
    });

  if (!usable.length) return [];

  const heights = usable.map(w => w.bbox.y1 - w.bbox.y0).filter(Boolean);
  const typicalHeight = Math.max(10, median(heights));
  const tolerance = typicalHeight * 0.75;
  const lines = [];

  for (const word of usable) {
    const cy = (word.bbox.y0 + word.bbox.y1) / 2;
    let line = null;
    for (const candidate of lines) {
      if (Math.abs(candidate.cy - cy) <= tolerance) {
        line = candidate;
        break;
      }
    }
    if (!line) {
      line = { cy, words: [] };
      lines.push(line);
    }
    line.words.push(word);
    line.cy = line.words.reduce((sum, w) => sum + ((w.bbox.y0 + w.bbox.y1) / 2), 0) / line.words.length;
  }

  return lines.sort((a, b) => a.cy - b.cy);
}

function extractDateTime(input) {
  let date = "";
  let time = "";

  const rawText = Array.isArray(input)
    ? input.map(w => (typeof w === "object" ? w.text || "" : String(w))).join(" ")
    : String(input || "");

  const cleanText = rawText.replace(/[,;]/g, " ");

  const timeMatch = cleanText.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM)?)\b/i);
  if (timeMatch) time = timeMatch[1].replace(/\s+/g, "");

  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  const dateMatch1 = cleanText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+(\d{2,4}))?\b/i);
  const dateMatch2 = cleanText.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{2,4}))?\b/i);
  const dateMatch3 = cleanText.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);

  const now = new Date();
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
  } else if (dateMatch3) {
    day = parseInt(dateMatch3[1], 10);
    month = parseInt(dateMatch3[2], 10);
    year = parseInt(dateMatch3[3], 10);
    if (year < 100) year += 2000;
  }

  if (day && month) {
    date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  if (!date) date = new Date().toISOString().slice(0, 10);
  return { date, time };
}

// 1. PDF Statement Parser
async function parsePDFFile(file) {
  if (typeof pdfjsLib === "undefined") {
    console.error("PDF.js library missing.");
    return [];
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const transactions = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    const items = textContent.items.map(item => {
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      return {
        text: item.str,
        bbox: {
          x0: tx[4],
          y0: tx[5] - item.height,
          x1: tx[4] + item.width,
          y1: tx[5]
        }
      };
    });

    const lines = buildLines(items);

    for (const line of lines) {
      const lineText = line.words.map(w => w.text).join(" ").trim();
      if (!lineText) continue;

      if (!isTransactionSuccessful(lineText)) continue;

      const minusMatch = lineText.match(/(?:^|\s|\|)\s*-\s*([₹RsINRinr]?\s*\d+(?:\.\d{1,2})?)/i);
      if (!minusMatch) continue;

      const rawAmountNum = parseFloat(minusMatch[1].replace(/[₹RsINRinr,\s]/gi, ""));
      if (isNaN(rawAmountNum) || rawAmountNum <= 0) continue;

      const dateTime = extractDateTime(line.words);

      let merchant = "";
      if (lineText.includes("|")) {
        const parts = lineText.split("|").map(p => p.trim());
        merchant = parts[0] || "";
      } else {
        merchant = lineText
          .replace(/(?:SUCCESS|FAILED|PENDING)/gi, "")
          .replace(/-\s*[₹RsINRinr]?\s*\d+(?:\.\d{1,2})?/gi, "")
          .replace(/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}\b/gi, "")
          .replace(/\b(?:SBI|HDFC|ICICI|AXIS|BOB|PNB|UBI|YES)\s*\d*\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
      }

      merchant = merchant.replace(/^(Name|Transaction History)\s*/i, "").trim();

      if (merchant && rawAmountNum) {
        transactions.push({
          id: generateId(),
          merchant: merchant,
          amount: rawAmountNum,
          date: dateTime.date,
          time: dateTime.time,
          category: "",
          source: "PDF Statement"
        });
      }
    }
  }

  return transactions;
}

// 2. Screenshot Image OCR Parser
async function parseImageFile(file) {
  if (typeof Tesseract === "undefined") {
    alert("Tesseract.js library is missing or failed to load. Please check your internet script tag.");
    return [];
  }

  let imgUrl = null;
  try {
    imgUrl = URL.createObjectURL(file);

    const result = await Tesseract.recognize(imgUrl, "eng");
    const rawText = result?.data?.text || "";

    if (!rawText.trim()) return [];

    if (FAILED_STATUS_KEYWORDS.some(kw => rawText.toLowerCase().includes(kw))) {
      return [];
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // 1. EXTRACT AMOUNT (Prioritize currency symbol matches to prevent reading date digits)
    let amount = 0;
    const currencyMatch = rawText.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (currencyMatch) {
      amount = parseFloat(currencyMatch[1].replace(/,/g, ""));
    }

    if (!amount || isNaN(amount)) {
      const keywordMatch = rawText.match(/(?:Paid|Amount|Total|Debited|Sent|INR|Rs)\s*(?:of|for)?\s*₹?\s*([\d,]+(?:\.\d{1,2})?)/i);
      if (keywordMatch) {
        amount = parseFloat(keywordMatch[1].replace(/,/g, ""));
      }
    }

    if (!amount || isNaN(amount)) {
      for (const line of lines) {
        if (/\b(?:202[0-9]|19[0-9]{2})\b/.test(line)) continue;
        if (/\b\d{1,2}:\d{2}\b/.test(line)) continue;
        if (/\d{10,}/.test(line)) continue;

        const m = line.match(/\b([\d,]+(?:\.\d{2}))\b/);
        if (m) {
          const parsed = parseFloat(m[1].replace(/,/g, ""));
          if (parsed > 0 && parsed < 500000) {
            amount = parsed;
            break;
          }
        }
      }
    }

    if (!amount || isNaN(amount) || amount <= 0) return [];

    // 2. EXTRACT MERCHANT
    let merchant = "";

    for (const line of lines) {
      const mMatch = line.match(/(?:Paid to|To|Sent to|Transfer to|Paying|Transferred to|Payment to)\s+(.+)/i);
      if (mMatch) {
        merchant = mMatch[1].trim();
        break;
      }
    }

    if (!merchant) {
      for (let i = 0; i < lines.length; i++) {
        if (/^(Paid to|To|Sent to|Transfer to|Paying)$/i.test(lines[i]) && lines[i + 1]) {
          merchant = lines[i + 1].trim();
          break;
        }
      }
    }

    if (!merchant) {
      const ignoreRegex = /^(Paid|Success|Completed|Successful|Payment|Debit|Credit|₹|Rs|INR|To|From|Bank|UPI|Txn|Ref|GPay|PhonePe|Paytm|Google Pay|Date|Time|\d+)/i;
      for (const line of lines) {
        const cleanLine = line.replace(/[^\w\s&.-]/gi, "").trim();
        if (cleanLine.length >= 3 && !ignoreRegex.test(cleanLine)) {
          merchant = cleanLine;
          break;
        }
      }
    }

    merchant = merchant
      .replace(/(?:SUCCESS|COMPLETED|PAID|SUCCESSFUL|UPI ID|REF|TXN).*/gi, "")
      .replace(/[^\w\s&.-]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!merchant) merchant = "UPI Payment";

    // 3. EXTRACT DATE & TIME
    const dateTime = extractDateTime(rawText);

    return [{
      id: generateId(),
      merchant: merchant,
      amount: amount,
      date: dateTime.date,
      time: dateTime.time,
      category: "",
      source: "Screenshot OCR"
    }];

  } catch (err) {
    console.error("Image OCR error for", file.name, err);
  } finally {
    if (imgUrl) URL.revokeObjectURL(imgUrl);
  }

  return [];
}

// Combined Import Process
async function runOCR() {
  if (!files.length) return;

  if ($("#importBtn")) $("#importBtn").disabled = true;
  if ($("#ocrProgressWrap")) $("#ocrProgressWrap").classList.remove("hidden");
  if ($("#ocrStatus")) $("#ocrStatus").textContent = "● Processing files…";
  if ($("#ocrProgressBar")) $("#ocrProgressBar").style.width = "0%";

  let added = 0;
  let skipped = 0;

  const pdfFiles = files.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
  const imageFiles = files.filter(f => f.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(f.name));

  const totalFiles = pdfFiles.length + imageFiles.length;
  let processed = 0;

  try {
    for (let i = 0; i < pdfFiles.length; i++) {
      processed++;
      if ($("#ocrProgressText")) $("#ocrProgressText").textContent = `Parsing PDF statement ${i + 1} of ${pdfFiles.length}…`;
      if ($("#ocrProgressBar")) $("#ocrProgressBar").style.width = `${Math.round((processed / totalFiles) * 100)}%`;

      const pdfTx = await parsePDFFile(pdfFiles[i]);
      for (const transaction of pdfTx) {
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

    for (let i = 0; i < imageFiles.length; i++) {
      processed++;
      if ($("#ocrProgressText")) $("#ocrProgressText").textContent = `Scanning screenshot ${i + 1} of ${imageFiles.length}…`;
      if ($("#ocrProgressBar")) $("#ocrProgressBar").style.width = `${Math.round((processed / totalFiles) * 100)}%`;

      const imgTx = await parseImageFile(imageFiles[i]);
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
    if ($("#ocrProgressBar")) $("#ocrProgressBar").style.width = "100%";
    if ($("#ocrProgressText")) $("#ocrProgressText").textContent = `${added} transaction${added === 1 ? "" : "s"} imported`;

    save();
    showView("transactions");
    if ($("#ocrStatus")) $("#ocrStatus").textContent = "● Ready";
    alert(`${added} transaction${added === 1 ? "" : "s"} imported${skipped ? `; ${skipped} duplicate/failed entry${skipped === 1 ? "" : "ies"} excluded` : ""}.`);
  } catch (error) {
    console.error("Import error:", error);
    if ($("#ocrStatus")) $("#ocrStatus").textContent = "● Error processing file";
    alert("An error occurred while reading the files.");
  } finally {
    if ($("#importBtn")) $("#importBtn").disabled = !files.length;
    setTimeout(() => {
      if ($("#ocrProgressWrap")) $("#ocrProgressWrap").classList.add("hidden");
    }, 1000);
  }
}

// ==========================================
// INITIALIZATION
// ==========================================
renderAll();
showView(getActiveViewFromHash(), true);