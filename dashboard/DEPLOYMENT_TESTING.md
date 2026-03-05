# GitHub Pages Deployment Testing Guide

This document provides step-by-step instructions for testing the dashboard deployment to GitHub Pages.

## Prerequisites

Before testing, ensure:

1. ✅ GitHub Actions workflow is configured (`.github/workflows/deploy-dashboard.yml`)
2. ✅ GitHub repository secrets are set up:
   - `AWS_REGION`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `S3_BUCKET`
3. ✅ S3 bucket CORS is configured (see `S3_CORS_CONFIGURATION.md`)
4. ✅ GitHub Pages is enabled in repository settings

## Setting Up GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `AWS_REGION` | AWS region where S3 bucket is located | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key with S3 read permissions | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | `wJalrXUtn...` |
| `S3_BUCKET` | S3 bucket name | `b3tr-200093399689-us-east-1` |

### Creating IAM User for Dashboard

For security, create a dedicated IAM user with minimal permissions:

1. Go to AWS IAM Console
2. Create a new user (e.g., `dashboard-readonly`)
3. Attach the following inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME",
        "arn:aws:s3:::YOUR_BUCKET_NAME/*"
      ]
    }
  ]
}
```

4. Create access keys for this user
5. Use these credentials in GitHub secrets

## Enabling GitHub Pages

1. Go to your GitHub repository
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select **GitHub Actions**
4. Save the settings

## Triggering Deployment

### Method 1: Push to Main Branch

```bash
# Make a change to the dashboard
cd dashboard
# Edit a file or make any change
git add .
git commit -m "Update dashboard"
git push origin main
```

The workflow will automatically trigger when changes are pushed to the `dashboard/` directory.

### Method 2: Manual Trigger

1. Go to your GitHub repository
2. Navigate to **Actions** tab
3. Select **Deploy Dashboard to GitHub Pages** workflow
4. Click **Run workflow**
5. Select the `main` branch
6. Click **Run workflow**

## Monitoring Deployment

1. Go to the **Actions** tab in your repository
2. Click on the latest workflow run
3. Monitor the progress:
   - **Build** job: Installs dependencies and builds the React app
   - **Deploy** job: Deploys the built files to GitHub Pages

### Expected Workflow Steps

**Build Job:**
1. ✅ Checkout repository
2. ✅ Setup Node.js
3. ✅ Install dependencies
4. ✅ Build dashboard (with environment variables)
5. ✅ Upload artifact

**Deploy Job:**
1. ✅ Deploy to GitHub Pages

### Troubleshooting Workflow Failures

#### Build Fails at "Install dependencies"

**Cause**: Missing or corrupted `package-lock.json`

**Solution**:
```bash
cd dashboard
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
git push
```

#### Build Fails at "Build dashboard"

**Cause**: Missing environment variables or build errors

**Solution**:
1. Verify all GitHub secrets are set correctly
2. Check build logs for specific errors
3. Test build locally:
```bash
cd dashboard
export REACT_APP_AWS_REGION="us-east-1"
export REACT_APP_AWS_ACCESS_KEY_ID="your-key"
export REACT_APP_AWS_SECRET_ACCESS_KEY="your-secret"
export REACT_APP_S3_BUCKET="your-bucket"
npm run build
```

#### Deploy Fails

**Cause**: Permissions issue or GitHub Pages not enabled

**Solution**:
1. Verify GitHub Pages is enabled in repository settings
2. Check that the workflow has `pages: write` permission
3. Ensure the repository is public or you have GitHub Pro/Team

## Testing the Deployed Dashboard

### 1. Access the Dashboard

Open your browser and navigate to:
```
https://uesleisutil.github.io/b3-tactical-ranking
```

### 2. Verify Dashboard Loads

Check that:
- ✅ Page loads without errors
- ✅ Dashboard UI is visible
- ✅ No console errors (open Developer Tools with F12)
- ✅ Loading indicator appears initially

### 3. Verify Data Fetching

Check that data loads correctly:

#### Recommendations Table
- ✅ Table displays top 10 recommendations
- ✅ Columns show: Rank, Ticker, Score, Predicted Return, Sector
- ✅ Positive returns are green, negative returns are red
- ✅ Data is sorted by rank

#### Model Quality Panel
- ✅ Current metrics display: MAPE, Coverage, Predictions
- ✅ Line chart shows MAPE and coverage trends
- ✅ Warning indicators appear if thresholds exceeded
- ✅ Chart displays last 14 days of data

#### Ingestion Status Panel
- ✅ Success rate percentage displays
- ✅ Execution counts show: Total, Successful, Failed
- ✅ Bar chart shows records ingested over time
- ✅ Status indicator color matches success rate

#### System Status Panel
- ✅ Health indicators for all subsystems
- ✅ Icons reflect actual system health
- ✅ Green check marks for healthy systems

### 4. Verify Auto-Refresh

- ✅ Last updated timestamp displays
- ✅ Manual refresh button works
- ✅ Data refreshes automatically after 5 minutes
- ✅ Loading indicator shows during refresh

### 5. Test Error Handling

#### Test CORS Configuration

If data doesn't load, check browser console for CORS errors:

```
Access to fetch at 'https://s3.amazonaws.com/...' from origin 'https://uesleisutil.github.io' 
has been blocked by CORS policy
```

**Solution**: Follow `S3_CORS_CONFIGURATION.md` to configure CORS

#### Test Invalid Credentials

If you see authentication errors:
```
Error: The AWS Access Key Id you provided does not exist in our records
```

**Solution**: Verify GitHub secrets are set correctly

### 6. Test Responsive Design

Test the dashboard on different screen sizes:

#### Desktop (1920x1080+)
- ✅ All panels display side by side
- ✅ Charts are readable and properly sized
- ✅ No horizontal scrolling

#### Tablet (768x1024)
- ✅ Layout adjusts appropriately
- ✅ Charts remain readable
- ✅ Text is legible

#### Mobile (375x667)
- ✅ Panels stack vertically
- ✅ Charts scale to fit screen
- ✅ Text remains readable
- ✅ No content is cut off

**Testing Method**:
1. Open Developer Tools (F12)
2. Click the device toolbar icon (or Ctrl+Shift+M)
3. Select different device presets
4. Verify layout at each size

### 7. Performance Testing

#### Load Time
- ✅ Dashboard loads within 3 seconds on broadband
- ✅ Initial content displays quickly
- ✅ Charts render smoothly

**Testing Method**:
1. Open Developer Tools → Network tab
2. Disable cache
3. Refresh page
4. Check "Load" time at bottom of Network tab

#### Data Fetching
- ✅ Only necessary data files are fetched
- ✅ No redundant S3 requests within refresh interval
- ✅ Timeout warning appears if fetch takes > 10 seconds

**Testing Method**:
1. Open Developer Tools → Network tab
2. Filter by "s3.amazonaws.com"
3. Count number of requests
4. Verify requests match expected files

## Common Issues and Solutions

### Issue: Dashboard Shows "Configuration Error"

**Cause**: Missing or invalid environment variables

**Solution**:
1. Verify all GitHub secrets are set
2. Check secret names match exactly (case-sensitive)
3. Rebuild and redeploy

### Issue: Dashboard Shows "Unable to Connect to Data Source"

**Cause**: Network error or S3 bucket unreachable

**Solution**:
1. Verify S3 bucket exists and is accessible
2. Check AWS credentials have correct permissions
3. Test S3 access using AWS CLI:
```bash
aws s3 ls s3://YOUR_BUCKET_NAME/recommendations/
```

### Issue: Dashboard Shows "Authentication Failed"

**Cause**: Invalid AWS credentials

**Solution**:
1. Verify credentials in GitHub secrets
2. Test credentials using AWS CLI:
```bash
aws s3 ls s3://YOUR_BUCKET_NAME/ \
  --region YOUR_REGION
```
3. Ensure IAM user has S3 read permissions

### Issue: Dashboard Shows "Data Parsing Failed"

**Cause**: Malformed JSON in S3 files

**Solution**:
1. Download a sample file from S3
2. Validate JSON format using a JSON validator
3. Check that all required fields are present
4. Verify data matches expected schema

### Issue: Charts Don't Display

**Cause**: Missing or insufficient data

**Solution**:
1. Check browser console for errors
2. Verify data files exist in S3
3. Ensure data covers required time ranges:
   - Quality data: Last 30 days
   - Ingestion data: Last 48 hours

### Issue: CORS Errors in Console

**Cause**: S3 bucket CORS not configured

**Solution**: Follow `S3_CORS_CONFIGURATION.md`

## Deployment Checklist

Use this checklist before considering deployment complete:

### Pre-Deployment
- [ ] GitHub secrets configured
- [ ] S3 CORS configured
- [ ] GitHub Pages enabled
- [ ] IAM user created with minimal permissions

### Deployment
- [ ] Workflow runs successfully
- [ ] Build job completes without errors
- [ ] Deploy job completes without errors
- [ ] No errors in workflow logs

### Post-Deployment
- [ ] Dashboard URL is accessible
- [ ] Page loads without errors
- [ ] All data panels display correctly
- [ ] Recommendations table shows data
- [ ] Model quality panel shows metrics and chart
- [ ] Ingestion status panel shows metrics and chart
- [ ] System status panel shows health indicators
- [ ] Auto-refresh works (wait 5 minutes)
- [ ] Manual refresh button works
- [ ] Responsive design works on mobile/tablet
- [ ] No CORS errors in console
- [ ] No authentication errors
- [ ] Performance is acceptable (< 3s load time)

## Rollback Procedure

If deployment fails or issues are found:

1. **Revert to Previous Version**:
```bash
git revert HEAD
git push origin main
```

2. **Disable Workflow** (temporary):
   - Go to Actions → Deploy Dashboard workflow
   - Click "..." → Disable workflow

3. **Fix Issues Locally**:
```bash
cd dashboard
# Make fixes
npm test
npm run build
# Test locally
```

4. **Redeploy**:
```bash
git add .
git commit -m "Fix deployment issues"
git push origin main
```

## Monitoring Production

After successful deployment, monitor:

1. **GitHub Actions**: Check for failed workflow runs
2. **Browser Console**: Monitor for JavaScript errors
3. **Data Freshness**: Verify data updates regularly
4. **User Reports**: Track any issues reported by users

## Next Steps

After successful deployment:

1. ✅ Document the dashboard URL for stakeholders
2. ✅ Set up monitoring/alerting if needed
3. ✅ Create user documentation
4. ✅ Train users on dashboard features
5. ✅ Plan for regular maintenance and updates
