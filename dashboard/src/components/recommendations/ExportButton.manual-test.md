# ExportButton Manual Testing Guide

## Overview
This guide provides manual testing steps to verify the ExportButton component meets all requirements.

## Prerequisites
1. Start the dashboard application: `npm start`
2. Navigate to the Recommendations tab
3. Ensure there is recommendation data loaded

## Test Cases

### Requirement 2.1: Export Button Display
**Steps:**
1. Navigate to the Recommendations tab
2. Look for the "Exportar" button in the action bar (top right area)

**Expected Result:**
- ✅ Export button is visible
- ✅ Button shows a download icon
- ✅ Button is enabled when data is present
- ✅ Button is disabled when no data is available

---

### Requirement 2.2: Format Selection Menu
**Steps:**
1. Click the "Exportar" button
2. Observe the dropdown menu that appears

**Expected Result:**
- ✅ Menu displays two options:
  - "Exportar como CSV" with file icon
  - "Exportar como Excel" with spreadsheet icon
- ✅ Menu appears below the button
- ✅ Menu has proper styling (white background, shadow, border)

**Additional Test:**
1. Click outside the menu
2. Verify the menu closes

---

### Requirement 2.3: CSV Export
**Steps:**
1. Click "Exportar" button
2. Select "Exportar como CSV"
3. Check your Downloads folder for the file

**Expected Result:**
- ✅ CSV file is downloaded
- ✅ File opens in spreadsheet application
- ✅ File contains headers: Rank, Ticker, Score, Expected Return (%), Sector
- ✅ File contains all visible recommendation data
- ✅ Numeric values are properly formatted:
  - Score: 1 decimal place (e.g., 85.5)
  - Expected Return: 2 decimal places as percentage (e.g., 12.00)
- ✅ Text values with commas are properly quoted

**Sample CSV Content:**
```
Rank,Ticker,Score,Expected Return (%),Sector
1,PETR4,85.5,12.00,Energy
2,VALE3,78.2,8.00,Materials
3,ITUB4,92.1,15.00,Finance
```

---

### Requirement 2.4: Excel Export
**Steps:**
1. Click "Exportar" button
2. Select "Exportar como Excel"
3. Check your Downloads folder for the file

**Expected Result:**
- ✅ Excel file (.xlsx) is downloaded
- ✅ File opens in Excel/LibreOffice/Google Sheets
- ✅ File contains a worksheet named "Recommendations"
- ✅ File contains headers: Rank, Ticker, Score, Expected Return (%), Sector
- ✅ File contains all visible recommendation data
- ✅ Columns have appropriate widths for readability
- ✅ Numeric values are properly formatted

---

### Requirement 2.5: Column Headers in Exported Files
**Steps:**
1. Export data to CSV
2. Export data to Excel
3. Open both files

**Expected Result:**
- ✅ Both files contain the same headers
- ✅ Headers are in the first row
- ✅ Headers are descriptive and match the table columns

---

### Requirement 2.6: Apply Active Filters to Exported Data
**Steps:**
1. Apply a sector filter (e.g., select "Finance")
2. Note the filtered results in the table
3. Click "Exportar" and select CSV
4. Open the downloaded file

**Expected Result:**
- ✅ Exported file contains only Finance sector stocks
- ✅ Number of rows matches the filtered table

**Additional Test - Multiple Filters:**
1. Apply sector filter: "Finance"
2. Apply minimum score filter: 85
3. Export to CSV
4. Verify exported data matches both filters

**Additional Test - No Filters:**
1. Clear all filters
2. Export to CSV
3. Verify all recommendations are exported

---

### Requirement 2.7: Filename with Timestamp
**Steps:**
1. Export data to CSV
2. Check the filename in your Downloads folder
3. Export data to Excel
4. Check the filename

**Expected Result:**
- ✅ CSV filename format: `recommendations_YYYY-MM-DD_HH-MM-SS.csv`
- ✅ Excel filename format: `recommendations_YYYY-MM-DD_HH-MM-SS.xlsx`
- ✅ Timestamp reflects the current date and time
- ✅ Timestamp uses 24-hour format
- ✅ Date separators are hyphens
- ✅ Time separators are hyphens (not colons, for filesystem compatibility)

**Example filenames:**
- `recommendations_2024-01-15_14-30-45.csv`
- `recommendations_2024-01-15_14-30-47.xlsx`

---

### Requirement 2.8: Browser Download Trigger
**Steps:**
1. Click "Exportar" button
2. Select either CSV or Excel format
3. Observe browser behavior

**Expected Result:**
- ✅ Browser download is triggered automatically
- ✅ No additional user interaction required
- ✅ File appears in Downloads folder
- ✅ Export menu closes after download starts
- ✅ No error messages appear

---

## Error Handling Tests

### Test: Empty Data
**Steps:**
1. Navigate to a state with no recommendations (or filter to show 0 results)
2. Observe the export button

**Expected Result:**
- ✅ Export button is disabled
- ✅ Button shows reduced opacity
- ✅ Cursor shows "not-allowed" when hovering

---

### Test: Export During Loading
**Steps:**
1. Click export button
2. Immediately click a format option
3. Observe the button state

**Expected Result:**
- ✅ Button shows "Exportando..." text
- ✅ Button is disabled during export
- ✅ Export completes successfully

---

## Integration Tests

### Test: Export with Comparison Mode Active
**Steps:**
1. Enable comparison mode
2. Select some tickers
3. Export data

**Expected Result:**
- ✅ Export works normally
- ✅ All visible (filtered) data is exported, not just selected tickers

---

### Test: Export After Clearing Filters
**Steps:**
1. Apply filters
2. Export (verify filtered data)
3. Clear all filters
4. Export again

**Expected Result:**
- ✅ First export contains filtered data
- ✅ Second export contains all data

---

## Browser Compatibility

Test the export functionality in:
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge

**Expected Result:**
- Export works in all browsers
- Downloaded files open correctly in all browsers

---

## Performance Tests

### Test: Large Dataset Export
**Steps:**
1. Load a large dataset (100+ recommendations)
2. Export to CSV
3. Export to Excel

**Expected Result:**
- ✅ Export completes within 2 seconds
- ✅ No browser freezing or lag
- ✅ Files are complete and accurate

---

## Accessibility Tests

### Test: Keyboard Navigation
**Steps:**
1. Tab to the export button
2. Press Enter to open menu
3. Use arrow keys to navigate options
4. Press Enter to select an option

**Expected Result:**
- ✅ Button is keyboard accessible
- ✅ Menu can be navigated with keyboard
- ✅ Export can be triggered with keyboard

---

## Summary Checklist

Use this checklist to verify all requirements are met:

- [ ] Req 2.1: Export button is displayed on Recommendations tab
- [ ] Req 2.2: Format options (CSV and Excel) are displayed when button is clicked
- [ ] Req 2.3: CSV export generates valid CSV file with all visible data
- [ ] Req 2.4: Excel export generates valid Excel file with all visible data
- [ ] Req 2.5: Column headers are included in exported files
- [ ] Req 2.6: Active filters are applied to exported data
- [ ] Req 2.7: Filenames use format "recommendations_YYYY-MM-DD_HH-MM-SS"
- [ ] Req 2.8: Browser download is triggered automatically

---

## Notes

- The ExportButton component uses the `xlsx` library for Excel export (already installed)
- CSV export uses a manual implementation (no external library needed)
- The component receives filtered data from the parent (RecommendationsPage)
- Filters are applied before data reaches the ExportButton component
- The component is fully self-contained and handles all export logic internally
