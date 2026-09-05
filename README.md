# BudgetOS — Simple OCR Import MVP

This build intentionally removes the complex vision/LLM pipeline.

## The one thing the screenshot feature does

**Upload a payment-history screenshot → OCR finds individual transaction rows → each row is automatically added as an Uncategorized transaction.**

There is no AI categorization, no approval step, and no manual transcription.

You manually select the category afterward.

## Categories

- Eating out
- Fruits
- Utilities
- Coffee & snacks
- Shopping
- Miscellaneous
- Transport

## Why this version does not use Ollama

For this particular workflow, the screenshot is a table/history list. We only need text/number extraction and row grouping. The MVP uses **Tesseract.js in the browser** so there is no Ollama setup, no Python OCR dependency, and no local AI model to manage.

The app handles the OCR automatically when you press **Read & import transactions**.

## Run

### Easiest

Double-click `start.bat`.

It starts a local web server and opens:

```text
http://localhost:8000
```

### Or manually

From PowerShell in this folder:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Test

Upload one payment-history screenshot.

The OCR parser is designed for history rows where:
- merchant text is on the left
- payment amount is on the right
- dates/times are separate text
- the screenshot may have decorative UI elements

It also includes a correction for the common OCR error where the Indian ₹ symbol is recognized as a leading `2` (for example `-₹138` becoming `-2138`).

## Data

Transactions are stored in browser `localStorage`.

Screenshot processing happens in the browser using Tesseract.js. The image is not sent to Ollama.

## Next development step

Once row extraction is reliable on your actual PhonePe/GPay screenshots, the category UI can be expanded and the budget logic can be refined without changing the import architecture.


## V2 OCR accuracy improvements

This build improves row extraction without adding AI:
- Automatic image upscaling and grayscale/contrast preprocessing
- Tesseract PSM 6 for block/table-like history screens
- Higher OCR DPI hint
- Explicit filtering of timestamps and dates from amount detection
- Amount selection biased to the right side of the row
- Handles OCR currency-symbol errors such as `₹138` becoming `2138`
- Reconstructs some wrapped rows
- De-duplicates only exact row matches, so separate merchants with the same amount are preserved
