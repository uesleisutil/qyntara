# Implementation Plan: GitHub-Hosted Dashboard

## Overview

This plan implements a static React dashboard hosted on GitHub Pages that replaces AWS QuickSight. The dashboard fetches data directly from S3 using the AWS SDK, displays trading recommendations, model quality metrics, and ingestion status with auto-refresh capabilities. The implementation follows a component-based architecture with Recharts for visualizations.

## Tasks

- [x] 1. Remove QuickSight infrastructure and references
  - Delete infra/lib/quicksight-stack.ts file
  - Delete infra/quicksight-manifest.json file
  - Delete scripts/setup-quicksight-permissions.sh file
  - Remove QuickSight stack import and instantiation from infra/lib/infra-stack.ts
  - Remove QuickSight-related outputs from infra/lib/infra-stack.ts
  - Update documentation to remove QuickSight references
  - _Requirements: User request to remove all QuickSight references_

- [x] 2. Set up React project structure and dependencies
  - Create dashboard directory with Create React App
  - Install dependencies: recharts, @aws-sdk/client-s3, date-fns, lucide-react
  - Configure package.json with GitHub Pages deployment settings
  - Create .env.example with required AWS configuration variables
  - Set up project structure: src/components, src/utils, src/hooks
  - _Requirements: 6.1, 6.2, 7.1, 7.2_

- [x] 3. Implement S3 data fetching layer
  - [x] 3.1 Create S3Client configuration with environment variables
    - Configure S3Client with region and credentials from REACT_APP_* env vars
    - Implement credential validation before data fetching
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ]* 3.2 Write property test for S3Client configuration
    - **Property 19: S3 Client Configuration**
    - **Validates: Requirements 7.1, 7.2**
  
  - [x] 3.3 Implement readS3Object utility function
    - Create function to fetch and parse JSON from S3
    - Handle GetObject command with proper error handling
    - Return parsed JSON or null on error
    - _Requirements: 1.1, 2.1, 3.1, 10.1, 10.2_
  
  - [x] 3.4 Implement listS3Objects utility function
    - Create function to list objects with given prefix
    - Use ListObjectsV2 command
    - Return array of S3 objects with keys and timestamps
    - _Requirements: 1.1, 2.1, 3.1_
  
  - [ ]* 3.5 Write property test for efficient data fetching
    - **Property 22: Efficient Data Fetching**
    - **Validates: Requirements 9.2**

- [x] 4. Implement data loading functions
  - [x] 4.1 Create loadRecommendations function
    - List objects in recommendations/ prefix
    - Find most recent file by LastModified timestamp
    - Fetch and parse recommendation data
    - Update state with recommendations array
    - _Requirements: 1.1, 1.4_
  
  - [ ]* 4.2 Write property test for most recent recommendation fetch
    - **Property 1: Most Recent Recommendation Fetch**
    - **Validates: Requirements 1.1**
  
  - [x] 4.3 Create loadQualityData function
    - List objects in monitoring/model_quality/ prefix
    - Filter files to last 30 days
    - Fetch and parse all quality data files
    - Update state with quality data array
    - _Requirements: 2.1, 2.6_
  
  - [ ]* 4.4 Write property test for quality data time window
    - **Property 5: Quality Data Time Window**
    - **Validates: Requirements 2.1**
  
  - [x] 4.5 Create loadIngestionData function
    - List objects in monitoring/ingestion/ prefix
    - Filter files to last 48 hours
    - Fetch and parse all ingestion data files
    - Update state with ingestion data array
    - _Requirements: 3.1, 3.6_
  
  - [ ]* 4.6 Write property test for ingestion data time window
    - **Property 9: Ingestion Data Time Window**
    - **Validates: Requirements 3.1**
  
  - [x] 4.7 Create loadData orchestration function
    - Call all three load functions in parallel
    - Handle errors gracefully for each data source
    - Update loading state and lastUpdated timestamp
    - Log errors to console
    - _Requirements: 5.2, 10.4_
  
  - [ ]* 4.8 Write property test for error logging
    - **Property 24: Error Logging**
    - **Validates: Requirements 10.4**

- [x] 5. Checkpoint - Verify data fetching works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement RecommendationsTable component
  - [x] 6.1 Create table component with rank, ticker, score, predicted return, sector columns
    - Display top 10 recommendations
    - Sort by rank in ascending order
    - Handle empty state with appropriate message
    - _Requirements: 1.2, 1.5, 1.4_
  
  - [ ]* 6.2 Write property test for top 10 recommendations display
    - **Property 2: Top 10 Recommendations Display**
    - **Validates: Requirements 1.2**
  
  - [ ]* 6.3 Write property test for recommendation sorting
    - **Property 4: Recommendation Sorting**
    - **Validates: Requirements 1.5**
  
  - [x] 6.4 Implement color-coding for predicted returns
    - Apply green styling for positive returns
    - Apply red styling for negative returns
    - _Requirements: 1.3_
  
  - [ ]* 6.5 Write property test for return color coding
    - **Property 3: Return Color Coding**
    - **Validates: Requirements 1.3**

- [x] 7. Implement ModelQualityPanel component
  - [x] 7.1 Create metrics display for MAPE, coverage, predictions
    - Display current MAPE, coverage, successful predictions, total predictions
    - Handle empty state with appropriate message
    - _Requirements: 2.2, 2.6_
  
  - [ ]* 7.2 Write property test for quality metrics display
    - **Property 6: Quality Metrics Display**
    - **Validates: Requirements 2.2**
  
  - [x] 7.3 Implement line chart for MAPE and coverage trends
    - Filter data to last 14 days
    - Configure X-axis with date formatting (dd/MM)
    - Configure Y-axis as percentage (0-100%)
    - Add MAPE line (red) and coverage line (green)
    - Add tooltip with formatted values
    - _Requirements: 2.3_
  
  - [ ]* 7.4 Write property test for quality chart time window
    - **Property 7: Quality Chart Time Window**
    - **Validates: Requirements 2.3**
  
  - [x] 7.5 Implement warning indicators for quality thresholds
    - Display warning when MAPE > 15%
    - Display warning when coverage < 80%
    - _Requirements: 2.4, 2.5_
  
  - [ ]* 7.6 Write property test for quality warning indicators
    - **Property 8: Quality Warning Indicators**
    - **Validates: Requirements 2.4, 2.5**

- [x] 8. Implement IngestionStatusPanel component
  - [x] 8.1 Create metrics display for ingestion statistics
    - Calculate success rate for last 24 hours
    - Display total executions, successful executions, failed executions
    - Handle empty state with appropriate message
    - _Requirements: 3.2, 3.3_
  
  - [ ]* 8.2 Write property test for success rate calculation
    - **Property 10: Success Rate Calculation**
    - **Validates: Requirements 3.2**
  
  - [ ]* 8.3 Write property test for ingestion execution counts
    - **Property 11: Ingestion Execution Counts**
    - **Validates: Requirements 3.3**
  
  - [x] 8.4 Implement bar chart for records ingested
    - Filter data to last 24 hours
    - Configure X-axis with time formatting (HH:mm)
    - Configure Y-axis for record count
    - Add bars for records ingested (blue)
    - Add tooltip with formatted values
    - _Requirements: 3.4_
  
  - [ ]* 8.5 Write property test for ingestion chart time window
    - **Property 12: Ingestion Chart Time Window**
    - **Validates: Requirements 3.4**
  
  - [x] 8.6 Implement status indicators based on success rate
    - Display green (healthy) indicator when success rate ≥ 90%
    - Display yellow (warning) indicator when 70% ≤ success rate < 90%
    - Display red (critical) indicator when success rate < 70%
    - _Requirements: 3.5, 3.6, 3.7_
  
  - [ ]* 8.7 Write property test for ingestion status indicators
    - **Property 13: Ingestion Status Indicators**
    - **Validates: Requirements 3.5, 3.6, 3.7**

- [x] 9. Implement SystemStatusPanel component
  - [x] 9.1 Create health indicators for all subsystems
    - Display green check mark for ingestion when success rate ≥ 90%
    - Display green check mark for model quality when MAPE ≤ 15% AND coverage ≥ 80%
    - Display green check mark for recommendations when data available
    - Display warning/error icons otherwise
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ]* 9.2 Write property test for system status health indicators
    - **Property 14: System Status Health Indicators**
    - **Validates: Requirements 4.2, 4.3**
  
  - [x] 9.3 Implement status update on data refresh
    - Update all indicators when new data loads
    - _Requirements: 4.4_
  
  - [ ]* 9.4 Write property test for status update on refresh
    - **Property 15: Status Update on Refresh**
    - **Validates: Requirements 4.4**

- [x] 10. Checkpoint - Verify all components render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement auto-refresh mechanism
  - [x] 11.1 Create useEffect hook for auto-refresh
    - Call loadData on component mount
    - Set up interval to call loadData every 5 minutes
    - Clean up interval on component unmount
    - _Requirements: 5.1_
  
  - [ ]* 11.2 Write property test for auto-refresh interval
    - **Property 16: Auto-Refresh Interval**
    - **Validates: Requirements 5.1**
  
  - [x] 11.3 Implement timestamp display for last refresh
    - Update lastUpdated state on successful refresh
    - Display formatted timestamp in UI
    - _Requirements: 5.2_
  
  - [ ]* 11.4 Write property test for timestamp update on refresh
    - **Property 17: Timestamp Update on Refresh**
    - **Validates: Requirements 5.2**
  
  - [x] 11.5 Create manual refresh button
    - Add button that triggers loadData immediately
    - _Requirements: 5.3_
  
  - [x] 11.6 Implement loading indicator
    - Display loading state during data fetch
    - Hide loading state when fetch completes
    - _Requirements: 5.4_
  
  - [ ]* 11.7 Write property test for loading indicator display
    - **Property 18: Loading Indicator Display**
    - **Validates: Requirements 5.4**
  
  - [x] 11.8 Implement error handling for failed refresh
    - Display error notification on refresh failure
    - Preserve previous data when refresh fails
    - _Requirements: 5.5, 10.5_
  
  - [ ]* 11.9 Write property test for error state preservation
    - **Property 25: Error State Preservation**
    - **Validates: Requirements 10.5**

- [x] 12. Implement error handling and user feedback
  - [x] 12.1 Create error banner component
    - Display prominent error message at top of dashboard
    - Include error icon and dismissible button
    - Show specific error messages for different error types
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [x] 12.2 Implement network error handling
    - Catch NetworkingError and TimeoutError
    - Display user-friendly connectivity message
    - Log detailed error to console
    - _Requirements: 10.1, 10.4_
  
  - [x] 12.3 Implement authentication error handling
    - Catch CredentialsError and AccessDenied
    - Display configuration error message
    - Log detailed error to console
    - _Requirements: 10.3, 10.4_
  
  - [ ]* 12.4 Write property test for credential validation
    - **Property 20: Credential Validation**
    - **Validates: Requirements 7.3**
  
  - [x] 12.5 Implement data parsing error handling
    - Validate data structure before using
    - Catch JSON parsing errors
    - Display parsing error message
    - Log detailed error to console
    - _Requirements: 10.2, 10.4_
  
  - [x] 12.6 Implement configuration error checking
    - Check required environment variables at startup
    - Display clear error for missing variables
    - Prevent data fetching if configuration invalid
    - _Requirements: 7.4_

- [x] 13. Implement responsive design
  - [x] 13.1 Create responsive layout with CSS media queries
    - Ensure proper rendering on desktop (1920x1080+)
    - Ensure proper rendering on tablet (768x1024)
    - Ensure proper rendering on mobile (375x667)
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 13.2 Implement vertical stacking for mobile viewports
    - Apply vertical stacking when viewport width < 768px
    - Maintain readability at all screen sizes
    - _Requirements: 8.4, 8.5_
  
  - [ ]* 13.3 Write property test for responsive layout stacking
    - **Property 21: Responsive Layout Stacking**
    - **Validates: Requirements 8.4**

- [x] 14. Implement performance optimizations
  - [x] 14.1 Implement data caching in browser memory
    - Cache fetched data to avoid redundant S3 requests
    - Reuse cached data within refresh interval
    - _Requirements: 9.3_
  
  - [ ]* 14.2 Write property test for data caching
    - **Property 23: Data Caching**
    - **Validates: Requirements 9.3**
  
  - [x] 14.2 Optimize chart rendering performance
    - Ensure charts render without blocking UI thread
    - Use Recharts' built-in performance optimizations
    - _Requirements: 9.4_
  
  - [x] 14.3 Implement timeout warning for slow data fetching
    - Display timeout warning when fetch takes > 10 seconds
    - _Requirements: 9.5_

- [x] 15. Checkpoint - Verify performance and error handling
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Set up GitHub Pages deployment
  - [x] 16.1 Configure package.json for GitHub Pages
    - Add homepage field with GitHub Pages URL
    - Add predeploy and deploy scripts
    - _Requirements: 6.1, 6.2_
  
  - [x] 16.2 Create GitHub Actions workflow for automated deployment
    - Create .github/workflows/deploy-dashboard.yml
    - Configure workflow to build and deploy on push to main
    - Set up environment variables for AWS credentials
    - _Requirements: 6.5_
  
  - [x] 16.3 Configure S3 CORS for GitHub Pages domain
    - Update S3 bucket CORS policy to allow requests from GitHub Pages
    - Test CORS configuration
    - _Requirements: 6.4_
  
  - [x] 16.4 Test deployment to GitHub Pages
    - Verify dashboard loads correctly from GitHub Pages URL
    - Verify data fetching works from GitHub Pages
    - _Requirements: 6.3_

- [x] 17. Create documentation
  - [x] 17.1 Update dashboard/README.md with setup instructions
    - Document required environment variables
    - Document build and deployment process
    - Document local development setup
    - _Requirements: 7.1, 7.2, 7.5_
  
  - [x] 17.2 Update main project documentation
    - Update docs/architecture.md to reflect dashboard changes
    - Update docs/deployment.md with GitHub Pages deployment steps
    - Remove QuickSight references from all documentation
    - _Requirements: User request_

- [x] 18. Final checkpoint - End-to-end verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- The design uses JavaScript/React, so all implementation will be in TypeScript/JavaScript
- QuickSight removal is prioritized as the first task per user request
