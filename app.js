const BUDGET = {
  income: 80000,
  pg: 21000,
  savings: 40000,
  categories: [
    { key: "food", name: "Eating out", icon: "🍱", budget: 6000 },
    { key: "fruit", name: "Fruits", icon: "🍎", budget: 3000 },
    { key: "utilities", name: "Utilities", icon: "🧴", budget: 1000 },
    { key: "snacks", name: "Coffee & snacks", icon: "☕", budget: 1000 },
    { key: "shopping", name: "Shopping", icon: "🛍️", budget: 1000 },
    { key: "misc", name: "Miscellaneous", icon: "📦", budget: 1000 },
    { key: "transport", name: "Transport", icon: "🚶", budget: 500 }
  ],
  flex: 5500
};

const KEY = "budgetos_simple_ocr";
let state = JSON.parse(localStorage.getItem(KEY) || "null") || { transactions: [] };
let files = [];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

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
  return BUDGET.categories.find(c => c.key === k)?.name || "Uncategorized";
}

function unc() {
  return state.transactions.filter(t => !t.category);
}

function dateValue(t) {
  return new Date(`${t.date || "1970-01-01"}T${time24(t.time || "00:00")}`).getTime();
}

function time24(x) {
  const m = String(x).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return "00:00";
  let h = +m[1];
  if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
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

function renderDashboard() {
  const s = spent();
  const actual = BUDGET.income - BUDGET.pg - s;
  const rem = Math.max(0, 19000 - s);

  $("#totalSpent").textContent = money(s);
  $("#spendRemaining").textContent = money(rem);
  $("#actualSavings").textContent = money(actual);

  const p = Math.max(0, Math.min(100, (actual / BUDGET.savings) * 100));

  $("#saveBar").style.width = p + "%";
  $("#saveStatus").textContent = actual >= BUDGET.savings ? "ON TRACK" : "BEHIND";
  $("#saveStatus").style.color = actual >= BUDGET.savings ? "#91b66a" : "#df7777";

  $("#monthLabel").textContent = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  $("#categories").innerHTML = BUDGET.categories.map(c => {
    const v = catTotal(c.key);
    const cp = Math.min(100, (v / c.budget) * 100);
    return `
      <div class="category">
        <div class="icon">${c.icon}</div>
        <div class="name">${c.name}</div>
        <div class="value">${money(v)}</div>
        <div class="muted">of ${money(c.budget)}</div>
        <div class="mini">
          <span style="width:${cp}%"></span>
        </div>
      </div>
    `;
  }).join("");

  const u = unc();
  const banner = $("#uncatBanner");
  banner.textContent = u.length ? `${u.length} transaction${u.length === 1 ? " is" : "s are"} uncategorized. Tag them on the Transactions page.` : "";
  banner.classList.toggle("hidden", !u.length);

  const rec = [...state.transactions].sort((a, b) => dateValue(b) - dateValue(a)).slice(0, 6);
  $("#recent").innerHTML = rec.length
    ? rec.map(t => `
      <div class="transaction-row">
        <div>
          <div class="merchant">${esc(t.merchant)}</div>
          <div class="muted">${fmtDate(t.date)} ${t.time ? ` • ${esc(t.time)}` : ""} • ${catName(t.category)}</div>
        </div>
        <span class="tag">${esc(t.source || "Manual")}</span>
        <div class="amount">${money(t.amount)}</div>
      </div>
    `).join("")
    : `<div class="muted">No transactions yet.</div>`;

  const weekBudget = 4375;
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const ws = state.transactions
    .filter(t => new Date((t.date || "1970-01-01") + "T12:00:00") >= monday)
    .reduce((a, t) => a + Number(t.amount || 0), 0);

  const wl = Math.max(0, weekBudget - ws);
  $("#weekLeft").textContent = money(wl);
  $("#weekBar").style.width = Math.min(100, (ws / weekBudget) * 100) + "%";
  $("#weekText").textContent = ws <= weekBudget
    ? `You have ${money(wl)} left in the suggested weekly pace.`
    : `You are ${money(ws - weekBudget)} over this week's pace.`;
}

function options(selected) {
  return `
    <option value="">Uncategorized</option>
    ${BUDGET.categories.map(c => `
      <option value="${c.key}" ${selected === c.key ? "selected" : ""}>
        ${c.icon} ${c.name}
      </option>
    `).join("")}
  `;
}

function renderTransactions() {
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
    ...BUDGET.categories.map(c => ({ key: c.key, name: c.name, icon: c.icon }))
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
                <strong>${col.name}</strong>
                <span class="kanban-badge">${colTx.length}</span>
              </div>
              <div class="kanban-col-sum">${money(colSum)}</div>
            </div>
            <div class="kanban-cards-container">
              ${colTx.map(t => `
                <div class="kanban-card" draggable="true" data-card-id="${t.id}">
                  <div class="kanban-card-top">
                    <span class="kanban-merchant">${esc(t.merchant)}</span>
                    <button class="delete-card-btn" data-del="${t.id}">×</button>
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

    column.addEventListener("dragleave", () => {
      column.classList.remove("drag-over");
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
  const rows = BUDGET.categories.map(c => {
    const v = catTotal(c.key);
    return `
      <div class="budget-line">
        <strong>${c.icon} ${c.name}</strong>
        <span>${money(c.budget)}</span>
        <span>${money(v)}</span>
        <span>${v <= c.budget ? "On track" : "Over budget"}</span>
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
  $("#uncatCount").textContent = n || "";
  $("#inboxText").textContent = n
    ? `${n} transaction${n === 1 ? "" : "s"} waiting for a category.`
    : "Everything is categorized.";
}

function showView(v) {
  $$(".view").forEach(x => x.classList.toggle("active", x.id === v));
  $$(".nav-item").forEach(x => x.classList.toggle("active", x.dataset.view === v));
  $("#pageTitle").textContent = {
    dashboard: "Dashboard",
    transactions: "Transactions",
    upload: "Upload screenshot",
    budget: "Budget"
  }[v];
}

$$(".nav-item").forEach(b => b.onclick = () => showView(b.dataset.view));
$$("[data-go]").forEach(b => b.onclick = () => showView(b.dataset.go));

$("#quickAdd").onclick = () => openModal();
$("#addBtn").onclick = () => openModal();
$("#closeModal").onclick = () => $("#modal").classList.add("hidden");
$("#mCategory").innerHTML = options("");

function openModal() {
  $("#mDate").value = new Date().toISOString().slice(0, 10);
  $("#mMerchant").value = "";
  $("#mAmount").value = "";
  $("#mCategory").value = "";
  $("#modal").classList.remove("hidden");
}

$("#form").onsubmit = e => {
  e.preventDefault();
  state.transactions.push({
    id: crypto.randomUUID(),
    date: $("#mDate").value,
    merchant: $("#mMerchant").value.trim(),
    amount: +$("#mAmount").value,
    category: $("#mCategory").value,
    time: "",
    source: "Manual"
  });
  $("#modal").classList.add("hidden");
  save();
};

function handleFiles(selectedFiles) {
  files = [...selectedFiles];
  $("#previews").innerHTML = files.map((f, i) => `
    <div class="preview">
      <img src="${URL.createObjectURL(f)}" alt="Screenshot ${i + 1}">
    </div>
  `).join("");
  $("#importBtn").disabled = !files.length;
}

$("#fileInput").onchange = e => handleFiles(e.target.files);

const dropzone = $(".dropzone");
if (dropzone) {
  dropzone.addEventListener("dragover", e => e.preventDefault());
  dropzone.addEventListener("drop", e => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });
}

$("#importBtn").onclick = runOCR;

function isTimeToken(text) {
  return /^\d{1,2}:\d{2}(\s?[AP]M)?$/i.test(String(text || "").trim());
}

function isDateToken(text) {
  const s = String(text || "").trim();
  return (
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i.test(s) ||
    /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(s) ||
    /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i.test(s) ||
    /^20\d{2}$/.test(s)
  );
}

function parseAmountToken(text) {
  let rawText = String(text || "").trim();
  if (!rawText) return null;
  if (isTimeToken(rawText) || isDateToken(rawText) || rawText.includes(":")) return null;

  const hasExplicitCurrency = /[₹RsINRinr]/i.test(rawText);
  const hasLeadingMinusOrSymbol = /^[-–—~?zZeE32]/i.test(rawText);

  let digitsOnly = rawText.replace(/[₹RsINRinr,\s]/gi, "").replace(/[^0-9]/g, "");
  if (!digitsOnly) return null;

  let value = Number(digitsOnly);
  if (!Number.isFinite(value) || value <= 0 || value >= 500000) return null;
  if (value >= 1900 && value <= 2100) return null;

  if (!hasExplicitCurrency && hasLeadingMinusOrSymbol) {
    if (digitsOnly.length >= 3 && (digitsOnly.startsWith("3") || digitsOnly.startsWith("2"))) {
      const sliced = Number(digitsOnly.slice(1));
      if (sliced > 0 && sliced < value) {
        value = sliced;
      }
    }
  }

  return value;
}

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

function findLineAmount(line, imageWidth) {
  const rightWords = line.words
    .filter(w => w.bbox.x0 >= imageWidth * 0.40)
    .sort((a, b) => b.bbox.x0 - a.bbox.x0);

  for (const word of rightWords) {
    const parsed = parseAmountToken(word.text);
    if (parsed !== null) return { amount: parsed, word };
  }
  return null;
}

function merchantFromRegion(words, amountX, top, bottom) {
  const merchantWords = words
    .filter(w => {
      const cy = (w.bbox.y0 + w.bbox.y1) / 2;
      if (cy < top || cy > bottom) return false;
      if (w.bbox.x0 >= amountX - 15) return false;
      if (isTimeToken(w.text) || isDateToken(w.text)) return false;
      if (/^\d+$/.test(String(w.text).trim())) return false;
      return true;
    })
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);

  let merchant = merchantWords.map(w => w.text).join(" ").replace(/\s+/g, " ").trim();
  merchant = merchant
    .replace(/\b(history|filter|home|back|help|search|upi|payment|decredited|credited|paid to)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return merchant;
}

function extractDateTime(words) {
  let date = "";
  let time = "";
  const rawText = words.map(w => w.text || "").join(" ");
  const cleanText = rawText.replace(/[,;]/g, " ");

  const timeMatch = cleanText.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM)?)\b/i);
  if (timeMatch) time = timeMatch[1].replace(/\s+/g, "");

  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  const dateMatch1 = cleanText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:\s+(\d{2,4}))?\b/i);
  const dateMatch2 = cleanText.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{2,4}))?\b/i);
  const dateMatch3 = cleanText.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);

  const now = new Date();
  let day, month, year = now.getFullYear();

  if (dateMatch1) {
    day = parseInt(dateMatch1[1], 10);
    month = monthNames.indexOf(dateMatch1[2].toLowerCase()) + 1;
    if (dateMatch1[3]) {
      year = parseInt(dateMatch1[3], 10);
      if (year < 100) year += 2000;
    }
  } else if (dateMatch2) {
    day = parseInt(dateMatch2[2], 10);
    month = monthNames.indexOf(dateMatch2[1].toLowerCase()) + 1;
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
    if (!dateMatch1?.[3] && !dateMatch2?.[3] && !dateMatch3) {
      const currentMonth = now.getMonth() + 1;
      if (month > currentMonth) {
        year = year - 1;
      }
    }
    date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  if (!date) date = new Date().toISOString().slice(0, 10);
  return { date, time };
}

function extractRows(data) {
  const words = data.words || [];
  if (!words.length) return [];

  const maxWordX = Math.max(...words.map(w => w.bbox ? w.bbox.x1 : 0), 1000);
  const maxWordY = Math.max(...words.map(w => w.bbox ? w.bbox.y1 : 0), 1000);

  const width = data.imageWidth || maxWordX;
  const height = data.imageHeight || maxWordY;

  const lines = buildLines(words);
  const amountCandidates = [];

  for (const line of lines) {
    const found = findLineAmount(line, width);
    if (found) {
      amountCandidates.push({ amount: found.amount, word: found.word, cy: line.cy });
    }
  }

  if (!amountCandidates.length) return [];

  const amounts = [];
  for (const candidate of amountCandidates) {
    const duplicate = amounts.some(existing => Math.abs(existing.cy - candidate.cy) < 14 && existing.amount === candidate.amount);
    if (!duplicate) amounts.push(candidate);
  }

  amounts.sort((a, b) => a.cy - b.cy);
  const gaps = [];
  for (let i = 1; i < amounts.length; i++) {
    const gap = amounts[i].cy - amounts[i - 1].cy;
    if (gap > 25 && gap < height * 0.35) gaps.push(gap);
  }

  const typicalGap = gaps.length ? median(gaps) : Math.max(55, height / Math.max(8, amounts.length));
  const results = [];

  for (let i = 0; i < amounts.length; i++) {
    const current = amounts[i];
    const previous = amounts[i - 1];
    const next = amounts[i + 1];

    let top = previous ? (previous.cy + current.cy) / 2 : current.cy - typicalGap / 2;
    let bottom = next ? (current.cy + next.cy) / 2 : current.cy + typicalGap / 2;

    const edgeMargin = Math.max(10, height * 0.01);
    if (top <= edgeMargin || bottom >= height - edgeMargin) continue;

    const maximumRegion = typicalGap * 1.7;
    if (bottom - top > maximumRegion) {
      top = current.cy - maximumRegion / 2;
      bottom = current.cy + maximumRegion / 2;
    }

    const regionWords = words.filter(w => {
      const cy = (w.bbox.y0 + w.bbox.y1) / 2;
      return cy >= top && cy <= bottom;
    });

    const merchant = merchantFromRegion(regionWords, current.word.bbox.x0, top, bottom);
    const dateTime = extractDateTime(regionWords);

    results.push({
      id: crypto.randomUUID(),
      merchant: merchant || "Unidentified transaction",
      amount: current.amount,
      date: dateTime.date,
      time: dateTime.time,
      category: "",
      source: "Screenshot OCR",
      _y: current.cy
    });
  }

  return results.sort((a, b) => a._y - b._y).map(({ _y, ...row }) => row);
}

function preprocessImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const targetWidth = Math.max(img.width, 1800);
        const scale = targetWidth / img.width;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        let totalLuminance = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          totalLuminance += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        }
        const avgLuminance = totalLuminance / (pixels.length / 4);
        const isDarkMode = avgLuminance < 120;

        for (let i = 0; i < pixels.length; i += 4) {
          let gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];

          if (isDarkMode) {
            gray = 255 - gray;
          }

          const adjusted = Math.max(0, Math.min(255, (gray - 128) * 1.3 + 128));

          pixels[i] = adjusted;
          pixels[i + 1] = adjusted;
          pixels[i + 2] = adjusted;
        }

        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          resolve(blob || file);
        }, "image/png");
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image."));
    };

    img.src = url;
  });
}

async function runOCR() {
  if (!files.length) return;

  $("#importBtn").disabled = true;
  $("#ocrProgressWrap").classList.remove("hidden");
  $("#ocrStatus").textContent = "● Reading transaction table…";
  $("#ocrProgressBar").style.width = "0%";

  let added = 0;
  let skipped = 0;

  try {
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: message => {
        if (message.status === "recognizing text") {
          const progress = Math.round((message.progress || 0) * 100);
          $("#ocrProgressBar").style.width = `${progress}%`;
          $("#ocrProgressText").textContent = `Reading screenshot… ${progress}%`;
        }
      }
    });

    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "6",
      user_defined_dpi: "300"
    });

    for (let i = 0; i < files.length; i++) {
      $("#ocrProgressText").textContent = `Reading screenshot ${i + 1} of ${files.length}…`;
      const processed = await preprocessImage(files[i]);
      const result = await worker.recognize(processed);
      const transactions = extractRows(result.data);

      for (const transaction of transactions) {
        const duplicate = state.transactions.some(
          existing =>
            existing.date === transaction.date &&
            existing.time === transaction.time &&
            Number(existing.amount) === Number(transaction.amount) &&
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

    await worker.terminate();
    files = [];
    $("#fileInput").value = "";
    $("#previews").innerHTML = "";
    $("#ocrProgressBar").style.width = "100%";
    $("#ocrProgressText").textContent = `${added} transaction${added === 1 ? "" : "s"} detected`;

    save();
    showView("transactions");
    $("#ocrStatus").textContent = "● OCR engine ready";
    alert(`${added} transaction${added === 1 ? "" : "s"} imported${skipped ? `; ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : ""}.`);
  } catch (error) {
    console.error("OCR error:", error);
    $("#ocrStatus").textContent = "● OCR error";
    alert("The screenshot could not be processed.");
  } finally {
    $("#importBtn").disabled = !files.length;
    setTimeout(() => {
      $("#ocrProgressWrap").classList.add("hidden");
    }, 1000);
  }
}

renderAll();