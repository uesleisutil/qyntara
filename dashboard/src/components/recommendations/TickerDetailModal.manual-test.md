# TickerDetailModal - Manual Testing Guide

## Overview

This guide provides step-by-step instructions for manually testing the TickerDetailModal component to verify all requirements are met.

## Prerequisites

1. Dashboard application is running (`npm start`)
2. Navigate to the Recommendations tab
3. Ensure there are ticker recommendations displayed

## Test Cases

### Test 1: Modal Opens on Ticker Click (Requirement 3.1)

**Steps:**
1. Navigate to the Recommendations tab
2. Click on any ticker symbol in the recommendations table

**Expected Result:**
- ✅ Modal opens and displays
- ✅ Modal shows the clicked ticker symbol in the header
- ✅ Modal overlay darkens the background
- ✅ Modal is centered on the screen

**Status:** [ ] Pass [ ] Fail

---

### Test 2: Recommendation History Display (Requirement 3.2)

**Steps:**
1. Open a ticker detail modal (click any ticker)
2. Scroll to the "Histórico de Recomendações" section

**Expected Result:**
- ✅ Section header "Histórico de Recomendações" is visible
- ✅ Table displays with columns: Data, Score, Retorno
- ✅ Historical data is displayed (either real or mock data)
- ✅ Returns are color-coded (green for positive, red for negative)
- ✅ Table is scrollable if content exceeds height

**Status:** [ ] Pass [ ] Fail

---

### Test 3: Fundamental Metrics Display (Requirement 3.3)

**Steps:**
1. Open a ticker detail modal
2. Scroll to the "Métricas Fundamentalistas" section

**Expected Result:**
- ✅ Section header "Métricas Fundamentalistas" is visible
- ✅ Metrics are displayed in a grid layout
- ✅ At least these metrics are shown: P/L, P/VP, Div. Yield, ROE, Dív/PL
- ✅ Each metric has a label and value
- ✅ Values are properly formatted

**Status:** [ ] Pass [ ] Fail

---

### Test 4: Recent News Display (Requirement 3.4)

**Steps:**
1. Open a ticker detail modal
2. Scroll to the "Notícias Recentes" section

**Expected Result:**
- ✅ Section header "Notícias Recentes" with newspaper icon is visible
- ✅ News articles are displayed as cards
- ✅ Each article shows: title, source, and date
- ✅ Articles have hover effect (background changes)
- ✅ At least 3-5 news articles are displayed

**Status:** [ ] Pass [ ] Fail

---

### Test 5: Close Button Display (Requirement 3.5)

**Steps:**
1. Open a ticker detail modal
2. Look at the modal header

**Expected Result:**
- ✅ Close button (X icon) is visible in the top-right corner
- ✅ Button has hover effect
- ✅ Button has proper cursor (pointer)
- ✅ Button has ARIA label for accessibility

**Status:** [ ] Pass [ ] Fail

---

### Test 6a: Close on Escape Key (Requirement 3.6)

**Steps:**
1. Open a ticker detail modal
2. Press the Escape key on your keyboard

**Expected Result:**
- ✅ Modal closes immediately
- ✅ Background overlay disappears
- ✅ Focus returns to the main page

**Status:** [ ] Pass [ ] Fail

---

### Test 6b: Close on Overlay Click (Requirement 3.6)

**Steps:**
1. Open a ticker detail modal
2. Click on the dark overlay area (outside the modal content)

**Expected Result:**
- ✅ Modal closes immediately
- ✅ Background overlay disappears

**Status:** [ ] Pass [ ] Fail

---

### Test 6c: Close on Close Button Click (Requirement 3.6)

**Steps:**
1. Open a ticker detail modal
2. Click the X button in the top-right corner

**Expected Result:**
- ✅ Modal closes immediately
- ✅ Background overlay disappears

**Status:** [ ] Pass [ ] Fail

---

### Test 6d: Modal Content Click Does Not Close (Requirement 3.6)

**Steps:**
1. Open a ticker detail modal
2. Click anywhere inside the modal content (not the overlay)

**Expected Result:**
- ✅ Modal remains open
- ✅ No unexpected behavior

**Status:** [ ] Pass [ ] Fail

---

### Test 7: Loading Indicator Display (Requirement 3.7)

**Steps:**
1. Open browser DevTools Network tab
2. Set network throttling to "Slow 3G"
3. Click on a ticker to open the modal

**Expected Result:**
- ✅ Loading spinner is displayed immediately
- ✅ Text "Carregando detalhes..." is shown
- ✅ Loading state is centered in the modal
- ✅ Loading spinner animates (spins)
- ✅ After data loads, loading state disappears

**Status:** [ ] Pass [ ] Fail

---

### Test 8: Error Message Display (Requirement 3.8)

**Steps:**
1. Open browser DevTools Network tab
2. Block all network requests or set to offline mode
3. Click on a ticker to open the modal
4. Wait for the request to fail

**Expected Result:**
- ✅ Error message is displayed in a red/pink box
- ✅ Error icon (AlertCircle) is shown
- ✅ Error message text is user-friendly: "Falha ao carregar detalhes do ticker. Por favor, tente novamente."
- ✅ Modal remains open (doesn't close on error)
- ✅ User can still close the modal

**Note:** With the current implementation, the component falls back to mock data, so you may see mock data instead of an error. To test the error state, you would need to modify the code temporarily to not use fallback data.

**Status:** [ ] Pass [ ] Fail

---

### Test 9: Ensemble Model Contributions Display

**Steps:**
1. Open a ticker detail modal
2. Scroll to the "Contribuição dos Modelos do Ensemble" section

**Expected Result:**
- ✅ Section header is visible
- ✅ Four models are displayed: XGBoost, LSTM, Prophet, DeepAR
- ✅ Each model shows: name, weight percentage, prediction percentage
- ✅ Progress bars visualize the weights
- ✅ Progress bars are color-coded (blue)

**Status:** [ ] Pass [ ] Fail

---

### Test 10: Main Metrics Display

**Steps:**
1. Open a ticker detail modal
2. Look at the top section below the header

**Expected Result:**
- ✅ "Retorno Esperado" card is displayed with icon
- ✅ Return value is shown as percentage
- ✅ Return is color-coded (green for positive, red for negative)
- ✅ "Score de Confiança" card is displayed with icon
- ✅ Confidence score is shown as a number

**Status:** [ ] Pass [ ] Fail

---

### Test 11: Sector Information Display

**Steps:**
1. Open a ticker detail modal for a ticker with sector information
2. Scroll to the bottom of the modal

**Expected Result:**
- ✅ Sector information is displayed in a card
- ✅ Label "Setor" is shown
- ✅ Sector name is displayed

**Status:** [ ] Pass [ ] Fail

---

### Test 12: Modal Scrolling

**Steps:**
1. Open a ticker detail modal
2. Try scrolling within the modal content

**Expected Result:**
- ✅ Modal content is scrollable
- ✅ Header remains sticky at the top while scrolling
- ✅ Scrollbar appears when content exceeds viewport
- ✅ Background doesn't scroll when modal is open

**Status:** [ ] Pass [ ] Fail

---

### Test 13: Responsive Design

**Steps:**
1. Open a ticker detail modal
2. Resize browser window to different widths (desktop, tablet, mobile)

**Expected Result:**
- ✅ Modal adapts to screen size
- ✅ Modal has appropriate padding on small screens
- ✅ Content remains readable on all screen sizes
- ✅ Grid layouts adjust for smaller screens
- ✅ Modal doesn't overflow the viewport

**Status:** [ ] Pass [ ] Fail

---

### Test 14: Multiple Modal Opens

**Steps:**
1. Open a ticker detail modal
2. Close it
3. Open a different ticker detail modal
4. Repeat several times

**Expected Result:**
- ✅ Each modal opens correctly
- ✅ Data is refreshed for each ticker
- ✅ No memory leaks or performance issues
- ✅ Event listeners are properly cleaned up

**Status:** [ ] Pass [ ] Fail

---

### Test 15: API Integration (When Backend is Ready)

**Steps:**
1. Ensure backend API endpoints are deployed
2. Open browser DevTools Network tab
3. Click on a ticker to open the modal

**Expected Result:**
- ✅ Three API calls are made:
  - GET /api/ticker/{ticker}/history
  - GET /api/ticker/{ticker}/fundamentals
  - GET /api/ticker/{ticker}/news
- ✅ API calls include proper headers (x-api-key)
- ✅ Real data is displayed (not mock data)
- ✅ Console shows no warnings about using mock data

**Status:** [ ] Pass [ ] Fail [ ] N/A (Backend not ready)

---

## Test Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Modal Opens | [ ] | |
| 2. History Display | [ ] | |
| 3. Fundamentals Display | [ ] | |
| 4. News Display | [ ] | |
| 5. Close Button | [ ] | |
| 6a. Close on Escape | [ ] | |
| 6b. Close on Overlay | [ ] | |
| 6c. Close on Button | [ ] | |
| 6d. Content Click | [ ] | |
| 7. Loading Indicator | [ ] | |
| 8. Error Message | [ ] | |
| 9. Model Contributions | [ ] | |
| 10. Main Metrics | [ ] | |
| 11. Sector Info | [ ] | |
| 12. Modal Scrolling | [ ] | |
| 13. Responsive Design | [ ] | |
| 14. Multiple Opens | [ ] | |
| 15. API Integration | [ ] | |

## Known Issues

Document any issues found during testing:

1. 
2. 
3. 

## Browser Compatibility

Test on multiple browsers:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Accessibility Testing

- [ ] Test with keyboard only (no mouse)
- [ ] Test with screen reader (VoiceOver, NVDA, or JAWS)
- [ ] Verify color contrast meets WCAG standards
- [ ] Check focus indicators are visible

## Performance Testing

- [ ] Modal opens quickly (< 500ms)
- [ ] No lag when scrolling
- [ ] No memory leaks after multiple opens/closes
- [ ] API calls complete in reasonable time

## Notes

Add any additional observations or comments:

---

**Tester Name:** _______________
**Date:** _______________
**Environment:** _______________
**Overall Result:** [ ] Pass [ ] Fail
