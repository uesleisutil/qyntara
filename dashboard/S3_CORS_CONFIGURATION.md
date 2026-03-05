# S3 CORS Configuration for GitHub Pages

This document provides instructions for configuring CORS (Cross-Origin Resource Sharing) on your S3 bucket to allow the dashboard hosted on GitHub Pages to access data.

## Why CORS Configuration is Needed

When the dashboard runs in a browser from GitHub Pages (e.g., `https://uesleisutil.github.io/b3-tactical-ranking`), it makes requests to your S3 bucket. Browsers enforce the Same-Origin Policy, which blocks these requests unless the S3 bucket explicitly allows them through CORS configuration.

## CORS Configuration Steps

### Option 1: Using AWS Console

1. Navigate to the AWS S3 Console
2. Select your bucket (e.g., `b3tr-200093399689-us-east-1`)
3. Go to the **Permissions** tab
4. Scroll down to **Cross-origin resource sharing (CORS)**
5. Click **Edit**
6. Paste the CORS configuration (see below)
7. Click **Save changes**

### Option 2: Using AWS CLI

```bash
aws s3api put-bucket-cors \
  --bucket YOUR_BUCKET_NAME \
  --cors-configuration file://cors-config.json
```

## CORS Configuration JSON

Create a file named `cors-config.json` with the following content:

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedOrigins": [
      "https://uesleisutil.github.io"
    ],
    "ExposeHeaders": [
      "ETag",
      "x-amz-request-id"
    ],
    "MaxAgeSeconds": 3600
  },
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedOrigins": [
      "http://localhost:3000"
    ],
    "ExposeHeaders": [
      "ETag",
      "x-amz-request-id"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### Configuration Explanation

- **AllowedHeaders**: `["*"]` - Allows all headers in requests
- **AllowedMethods**: `["GET", "HEAD"]` - Only allows read operations (secure)
- **AllowedOrigins**: 
  - `https://uesleisutil.github.io` - Your GitHub Pages domain
  - `http://localhost:3000` - For local development
- **ExposeHeaders**: Headers that the browser can access in the response
- **MaxAgeSeconds**: `3600` - Browser caches CORS preflight response for 1 hour

### Security Notes

1. **Read-Only Access**: The configuration only allows GET and HEAD methods, preventing any write operations
2. **Specific Origins**: Only your GitHub Pages domain and localhost are allowed
3. **No Wildcards**: Avoid using `"*"` for AllowedOrigins in production as it allows any website to access your data

## Testing CORS Configuration

### Method 1: Browser Developer Tools

1. Open your dashboard at `https://uesleisutil.github.io/b3-tactical-ranking`
2. Open browser Developer Tools (F12)
3. Go to the **Network** tab
4. Refresh the page
5. Look for requests to S3 (e.g., `s3.amazonaws.com`)
6. Check the response headers for:
   - `access-control-allow-origin: https://uesleisutil.github.io`
   - `access-control-allow-methods: GET, HEAD`

### Method 2: Using curl

```bash
curl -H "Origin: https://uesleisutil.github.io" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://YOUR_BUCKET_NAME.s3.YOUR_REGION.amazonaws.com/recommendations/
```

Expected response should include CORS headers:
```
access-control-allow-origin: https://uesleisutil.github.io
access-control-allow-methods: GET, HEAD
access-control-max-age: 3600
```

### Method 3: Test from Dashboard

1. Deploy the dashboard to GitHub Pages
2. Open the dashboard URL
3. Check if data loads correctly
4. If you see CORS errors in the console, verify:
   - The CORS configuration is applied to the correct bucket
   - The AllowedOrigins includes your exact GitHub Pages URL
   - The bucket name in your environment variables matches the configured bucket

## Common CORS Errors and Solutions

### Error: "No 'Access-Control-Allow-Origin' header is present"

**Cause**: CORS is not configured on the S3 bucket

**Solution**: Apply the CORS configuration as described above

### Error: "The 'Access-Control-Allow-Origin' header has a value that is not equal to the supplied origin"

**Cause**: The origin in AllowedOrigins doesn't match your GitHub Pages URL

**Solution**: Verify the URL in AllowedOrigins exactly matches your GitHub Pages domain (including https://)

### Error: "Method GET is not allowed by Access-Control-Allow-Methods"

**Cause**: GET method is not in AllowedMethods

**Solution**: Ensure AllowedMethods includes "GET"

## Updating CORS Configuration

If you need to add additional origins (e.g., a custom domain):

1. Add the new origin to the AllowedOrigins array:
```json
"AllowedOrigins": [
  "https://uesleisutil.github.io",
  "https://your-custom-domain.com",
  "http://localhost:3000"
]
```

2. Apply the updated configuration using AWS Console or CLI

## Verifying Configuration

After applying the CORS configuration, verify it's working:

```bash
# Check CORS configuration
aws s3api get-bucket-cors --bucket YOUR_BUCKET_NAME
```

Expected output should show your CORS rules.

## Additional Resources

- [AWS S3 CORS Documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)
- [MDN CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Troubleshooting CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors-troubleshooting.html)
