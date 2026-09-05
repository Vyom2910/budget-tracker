# 📊 BudgetOS - OCR Expense Tracker

A lightweight, zero-backend budget tracker and receipt scanner that runs entirely inside your browser. Powered by client-side JavaScript, Tesseract.js OCR, and LocalStorage—no backend server or database required.

---

## ✨ Features

* **100% Client-Side & Private:** All OCR processing and transaction data stay in your browser (`LocalStorage`). No images or data are sent to external servers.
* **Smart OCR Date & Merchant Extraction:** Automatically parses transaction dates, times, amounts, and merchant names directly from payment screenshots (e.g., PhonePe, Google Pay, Paytm).
* **Live Financial Summary:** Displays monthly savings target tracking, suggested weekly pacing, and category budgets.
* **Transactions Overview:** Complete breakdown with total expenditure sum, transaction counts, manual categorization, and duplicate detection.
* **Cross-Device Ready:** Works on both desktop browsers and mobile devices.

---

## 🚀 How to Run Locally

Because this application relies strictly on standard web technologies (`index.html`, `styles.css`, `app.js`), you no longer need Python, Node.js, or local backend servers.

1. Double-click **`index.html`** in your project folder to open it directly in Chrome, Edge, Safari, or Firefox.
2. *(Optional)* Use the VS Code **Live Server** extension for hot-reloading while editing code.

---

## 🌐 Web App Deployment (GitHub Pages)

To host this as a live web application accessible on your laptop and phone:

1. Push this repository to GitHub.
2. Navigate to **Settings** > **Pages** in your repository.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
4. Select `main` branch and `/ (root)` folder, then click **Save**.
5. Access your app at: `https://<YOUR-GITHUB-USERNAME>.github.io/<YOUR-REPO-NAME>/`

*Tip: On mobile, open your GitHub Pages URL in Chrome or Safari and select **Add to Home Screen** to install it as a standalone web app.*

---

## 🛠️ Update & Maintenance Workflow

To push new code changes or UI tweaks to your live app using VS Code terminal:

```bash
git add .
git commit -m "Update feature or UI improvements"
git push