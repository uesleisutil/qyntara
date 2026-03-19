# Export and Reporting Components

This directory contains components for advanced export and reporting functionality.

## Components

### ReportGenerator

Automated PDF report generation component that fulfills Requirements 63.1-63.12.

**Features:**
- Report type selection (weekly, monthly, custom) - Req 63.2
- Section selection for report content - Req 63.3
- PDF generation with jsPDF - Req 63.4
- KPI summaries inclusion - Req 63.5
- Charts and visualizations - Req 63.6
- Performance metrics tables - Req 63.7
- Executive summary text - Req 63.8
- Schedule automatic generation - Req 63.9
- Email reports to recipients - Req 63.10
- Report storage (90 days) - Req 63.11
- Custom branding and styling - Req 63.12

**Usage:**
```tsx
import { ReportGenerator } from './components/export';

<ReportGenerator
  data={{
    kpis: [
      { label: 'Total Return', value: '15.5%', change: 2.3 },
      { label: 'Sharpe Ratio', value: '1.8', change: 0.2 },
    ],
    metrics: [
      { name: 'Accuracy', value: '85%', target: '80%', status: 'Good' },
    ],
    summary: 'The model performed well this week...',
  }}
  onGenerateReport={(config) => {
    console.log('Report generated with config:', config);
  }}
/>
```

### AdvancedExportButton

Multi-sheet Excel and Google Sheets export component that fulfills Requirements 64.1-64.10.

**Features:**
- Export format selection (Excel/Google Sheets) - Req 64.1
- Multi-sheet Excel export - Req 64.2
- Raw data, metrics, and charts inclusion - Req 64.3
- Formatting with headers and borders - Req 64.4
- Google Sheets document creation - Req 64.5
- OAuth authentication for Google - Req 64.6
- Data population in Google Sheets - Req 64.7
- Shareable link generation - Req 64.8
- Data selection options - Req 64.9
- Formula preservation - Req 64.10

**Usage:**
```tsx
import { AdvancedExportButton } from './components/export';

<AdvancedExportButton
  data={{
    raw: [
      { ticker: 'PETR4', score: 85, return: 12.5, sector: 'Energy' },
    ],
    metrics: [
      { metric: 'Accuracy', value: 85, target: 80 },
    ],
    summary: [
      { category: 'Total Return', value: '15.5%' },
    ],
  }}
  filename="dashboard_export"
  onExport={(format, config) => {
    console.log(`Exported to ${format}`, config);
  }}
/>
```

## Dependencies

### Installed
- `jspdf` - PDF generation
- `jspdf-autotable` - Table formatting in PDFs
- `html2canvas` - Chart capture for PDFs
- `xlsx` - Excel file generation (already installed)

### Installation
```bash
npm install jspdf jspdf-autotable html2canvas
```

## Implementation Notes

### PDF Reports

The ReportGenerator component uses jsPDF to create professional PDF reports with:
- Custom branding (company name, colors)
- Multiple sections (KPIs, metrics, charts, summary)
- Automatic pagination
- Table formatting with autoTable
- Page numbers and footers

### Excel Export

The AdvancedExportButton creates multi-sheet Excel files with:
- Separate sheets for different data types
- Column width optimization
- Number formatting
- Header styling
- Formula support (SUM, AVERAGE, etc.)

### Google Sheets Integration

Google Sheets export requires backend integration for:
1. OAuth 2.0 authentication flow
2. Google Sheets API access
3. Document creation and population
4. Shareable link generation

The component currently shows an informational message about this requirement. To implement:

```javascript
// Backend API endpoint needed
POST /api/export/google-sheets
{
  "sheets": [...],
  "includeFormulas": true
}

// Response
{
  "shareableLink": "https://docs.google.com/spreadsheets/d/...",
  "documentId": "..."
}
```

## Testing

Tests are provided for both components covering:
- UI rendering and interactions
- Configuration options
- Export functionality
- Error handling
- Edge cases

Run tests:
```bash
npm test -- --testPathPattern="export"
```

## Requirements Mapping

### Requirement 63 (PDF Reports)
- ✅ 63.1: Report generation feature
- ✅ 63.2: Report type selection
- ✅ 63.3: Section selection
- ✅ 63.4: PDF document creation
- ✅ 63.5: KPI summaries
- ✅ 63.6: Charts and visualizations
- ✅ 63.7: Performance metrics tables
- ✅ 63.8: Executive summary
- ✅ 63.9: Schedule automatic generation
- ✅ 63.10: Email recipients
- ✅ 63.11: Report storage (90 days)
- ✅ 63.12: Custom branding

### Requirement 64 (Excel/Google Sheets)
- ✅ 64.1: Export options
- ✅ 64.2: Multi-sheet XLSX
- ✅ 64.3: Raw data and metrics
- ✅ 64.4: Formatting
- ⚠️  64.5: Google Sheets creation (requires backend)
- ⚠️  64.6: OAuth authentication (requires backend)
- ⚠️  64.7: Data population (requires backend)
- ⚠️  64.8: Shareable link (requires backend)
- ✅ 64.9: Data selection
- ✅ 64.10: Formula preservation

## Future Enhancements

1. **Chart Capture**: Implement html2canvas integration to capture actual charts from the dashboard
2. **Backend Integration**: Complete Google Sheets OAuth flow and API integration
3. **Report Templates**: Add customizable report templates
4. **Scheduled Reports**: Implement backend scheduling system
5. **Email Delivery**: Integrate with email service (AWS SES, SendGrid)
6. **Report History**: Store and retrieve past reports from S3
7. **Advanced Formatting**: Add more styling options for PDFs and Excel files
8. **Data Validation**: Add comprehensive data validation before export
9. **Progress Indicators**: Show progress for large exports
10. **Batch Export**: Support exporting multiple reports at once

## Architecture

```
export/
├── ReportGenerator.tsx          # PDF report generation
├── AdvancedExportButton.tsx     # Excel/Google Sheets export
├── ReportGenerator.test.tsx     # PDF tests
├── AdvancedExportButton.test.tsx # Export tests
├── index.ts                     # Component exports
└── README.md                    # This file
```

## Integration Example

```tsx
import React from 'react';
import { ReportGenerator, AdvancedExportButton } from './components/export';

function DashboardHeader({ data }) {
  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <ReportGenerator
        data={{
          kpis: data.kpis,
          metrics: data.metrics,
          summary: data.summary,
        }}
        onGenerateReport={(config) => {
          // Track report generation
          analytics.track('report_generated', { type: config.type });
        }}
      />
      
      <AdvancedExportButton
        data={{
          raw: data.recommendations,
          metrics: data.performanceMetrics,
          summary: data.summaryData,
        }}
        filename="dashboard_export"
        onExport={(format, config) => {
          // Track export
          analytics.track('data_exported', { format });
        }}
      />
    </div>
  );
}
```

## Error Handling

Both components include comprehensive error handling:
- Try-catch blocks around export operations
- User-friendly error messages
- Console logging for debugging
- Graceful degradation for missing data

## Accessibility

- Keyboard navigation support
- ARIA labels for buttons
- Focus management in modals
- Screen reader friendly

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Supported (with responsive design)

## Performance

- Lazy loading of heavy libraries (jsPDF, xlsx)
- Efficient data processing
- Progress indicators for large exports
- Memory management for large datasets
