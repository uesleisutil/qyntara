# Security Configuration Guide

This document describes the security enhancements implemented for the B3 Tactical Ranking MLOps Dashboard.

## Overview

The security implementation addresses all requirements from Requirement 82 (Security and Authentication):

- ✅ **82.1**: User authentication required for all features
- ✅ **82.2**: Enterprise SSO integration (SAML, OAuth)
- ✅ **82.3**: Role-based access control (admin, analyst, viewer)
- ✅ **82.4**: Sensitive features restricted to admin users
- ✅ **82.5**: API key authentication for programmatic access
- ✅ **82.6**: Automatic API key rotation (90 days)
- ✅ **82.7**: All authentication attempts logged
- ✅ **82.8**: Session timeout after 60 minutes of inactivity
- ✅ **82.9**: TLS 1.3 for all data in transit
- ✅ **82.10**: Sensitive data encrypted at rest in S3
- ✅ **82.11**: CSRF protection for state-changing operations
- ✅ **82.12**: Input sanitization to prevent XSS attacks
- ✅ **82.13**: Rate limiting to prevent abuse
- ✅ **82.14**: Security audit capabilities

## Architecture

### Authentication Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. Login Request
       ▼
┌─────────────────┐
│  API Gateway    │
└──────┬──────────┘
       │
       │ 2. Authenticate
       ▼
┌─────────────────┐
│  Auth Service   │◄──────┐
└──────┬──────────┘       │
       │                  │
       │ 3. Verify        │
       ▼                  │
┌─────────────────┐       │
│  AWS Cognito    │       │
└──────┬──────────┘       │
       │                  │
       │ 4. Token         │
       └──────────────────┘
```

### Authorization Flow

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       │ 1. Extract Token
       ▼
┌─────────────────┐
│  Auth Service   │
└──────┬──────────┘
       │
       │ 2. Verify Token
       ▼
┌─────────────────┐
│  Check Role     │
└──────┬──────────┘
       │
       │ 3. Authorize
       ▼
┌─────────────────┐
│  Allow/Deny     │
└─────────────────┘
```

## Components

### 1. Authentication Service (`auth_service.py`)

**Purpose**: Handles all authentication and authorization logic.

**Key Functions**:
- `verify_cognito_token()`: Validates AWS Cognito access tokens
- `verify_api_key()`: Validates API keys and checks expiration
- `authenticate_request()`: Main authentication entry point
- `check_authorization()`: Role-based access control
- `create_api_key()`: Generate new API keys
- `rotate_api_key()`: Rotate expiring API keys
- `log_auth_attempt()`: Log all authentication attempts

**Configuration**:
```python
# Environment variables required
USER_POOL_ID = "us-east-1_XXXXXXXXX"
API_KEYS_TABLE = "B3Dashboard-APIKeys"
AUTH_LOGS_TABLE = "B3Dashboard-AuthLogs"

# Constants
SESSION_TIMEOUT_MINUTES = 60
API_KEY_ROTATION_DAYS = 90
```

### 2. Security Middleware (`security_middleware.py`)

**Purpose**: Applies security controls to all API requests.

**Features**:
- Input sanitization (XSS prevention)
- CSRF token validation
- Rate limiting
- Request size validation
- Security headers
- TLS version validation

**Usage**:
```python
from security_middleware import security_middleware

@security_middleware
def handler(event, context):
    # Your handler code
    pass
```

### 3. Data Encryption (`data_encryption.py`)

**Purpose**: Handles encryption of sensitive data at rest.

**Key Functions**:
- `upload_encrypted_to_s3()`: Upload data with KMS encryption
- `download_encrypted_from_s3()`: Download and decrypt data
- `enable_bucket_encryption()`: Configure bucket-level encryption
- `verify_bucket_encryption()`: Audit encryption configuration
- `mask_sensitive_data()`: Mask sensitive fields for logging

**Configuration**:
```python
# Environment variables required
KMS_KEY_ID = "arn:aws:kms:us-east-1:ACCOUNT:key/KEY-ID"
```

### 4. Security Audit (`security_audit.py`)

**Purpose**: Performs comprehensive security audits.

**Audit Checks**:
- Authentication flow review
- Authorization control testing
- Encryption verification
- API key rotation status
- OWASP Top 10 vulnerability checks
- Rate limiting implementation
- CSRF protection

**Usage**:
```bash
# Trigger audit manually
aws lambda invoke \
  --function-name SecurityAudit \
  --payload '{"bucket":"my-bucket","userPoolId":"us-east-1_XXX"}' \
  response.json

# Schedule quarterly audits with EventBridge
aws events put-rule \
  --name quarterly-security-audit \
  --schedule-expression "cron(0 0 1 */3 * ? *)"
```

## DynamoDB Tables

### API Keys Table

**Table Name**: `B3Dashboard-APIKeys`

**Schema**:
```
Primary Key: apiKeyHash (String)
GSI: UserIdIndex (userId)

Attributes:
- apiKeyHash: SHA-256 hash of API key
- userId: User identifier
- name: Friendly name
- role: User role (admin, analyst, viewer)
- createdAt: ISO timestamp
- expiresAt: ISO timestamp
- lastUsed: ISO timestamp (nullable)
- enabled: Boolean
- requestCount: Number
```

### Auth Logs Table

**Table Name**: `B3Dashboard-AuthLogs`

**Schema**:
```
Primary Key: userId (String)
Sort Key: timestamp (String)

Attributes:
- userId: User identifier
- timestamp: ISO timestamp
- authType: cognito | api_key | sso
- success: Boolean
- ipAddress: String
- userAgent: String
- reason: String (failure reason)
- ttl: Number (auto-delete after 90 days)
```

### Rate Limits Table

**Table Name**: `B3Dashboard-RateLimits`

**Schema**:
```
Primary Key: identifier (String)

Attributes:
- identifier: User ID, IP, or API key hash
- count: Number of requests
- windowStart: ISO timestamp
- ttl: Number (auto-delete)
```

## Role-Based Access Control

### Role Hierarchy

```
admin (level 3)
  ├─ Full access to all features
  ├─ User management
  ├─ API key management
  ├─ Security audit access
  └─ System configuration

analyst (level 2)
  ├─ View all data
  ├─ Export data
  ├─ Create alerts
  └─ Run backtests

viewer (level 1)
  ├─ View recommendations
  ├─ View performance metrics
  └─ View validation data
```

### Protected Endpoints

| Endpoint | Required Role | Description |
|----------|--------------|-------------|
| `/api/users/*` | admin | User management |
| `/api/keys/*` | admin | API key management |
| `/api/audit/*` | admin | Security audits |
| `/api/backtest/*` | analyst | Backtesting |
| `/api/export/*` | analyst | Data export |
| `/api/alerts/*` | analyst | Alert management |
| `/api/recommendations/*` | viewer | View recommendations |
| `/api/performance/*` | viewer | View performance |

## API Key Management

### Creating API Keys

```bash
# Via API
curl -X POST https://api.example.com/api/keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API Key",
    "role": "analyst",
    "expiresDays": 90
  }'

# Response
{
  "apiKey": "a1b2c3d4e5f6...",
  "apiKeyHash": "sha256hash...",
  "name": "Production API Key",
  "role": "analyst",
  "createdAt": "2024-01-15T10:00:00Z",
  "expiresAt": "2024-04-15T10:00:00Z"
}
```

### Using API Keys

```bash
# Option 1: Authorization header
curl https://api.example.com/api/recommendations \
  -H "Authorization: ApiKey YOUR_API_KEY"

# Option 2: X-API-Key header
curl https://api.example.com/api/recommendations \
  -H "X-API-Key: YOUR_API_KEY"
```

### Rotating API Keys

```bash
# Rotate before expiration
curl -X POST https://api.example.com/api/keys/{keyHash}/rotate \
  -H "Authorization: Bearer $TOKEN"

# Response includes new API key
{
  "apiKey": "new_key_here...",
  "message": "API key rotated successfully"
}
```

## Rate Limiting

### Configuration

```python
RATE_LIMIT_REQUESTS = 100  # requests per window
RATE_LIMIT_WINDOW = 60     # seconds
```

### Rate Limit Headers

Responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

### Rate Limit Exceeded Response

```json
{
  "statusCode": 429,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please wait and try again.",
  "retryAfter": 45
}
```

## CSRF Protection

### Token Generation

CSRF tokens are generated on login and stored in session:

```javascript
// Frontend
const csrfToken = response.headers.get('X-CSRF-Token');
localStorage.setItem('csrfToken', csrfToken);
```

### Token Validation

Include CSRF token in state-changing requests:

```javascript
// POST, PUT, DELETE requests
fetch('/api/resource', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': localStorage.getItem('csrfToken'),
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(data)
});
```

## Input Sanitization

### Automatic Sanitization

All input is automatically sanitized by the security middleware:

```python
# Sanitizes:
- HTML tags (except safe ones)
- JavaScript event handlers
- javascript: protocol
- data: protocol
- Script tags
```

### Manual Sanitization

For additional sanitization:

```python
from security_middleware import sanitize_input

# Sanitize user input
clean_data = sanitize_input(user_input)
```

## Encryption

### S3 Bucket Encryption

Enable default encryption for all buckets:

```python
from data_encryption import enable_bucket_encryption

enable_bucket_encryption(
    bucket="my-bucket",
    kms_key_id="arn:aws:kms:us-east-1:ACCOUNT:key/KEY-ID"
)
```

### Encrypting Sensitive Data

```python
from data_encryption import upload_encrypted_to_s3

# Upload with encryption
upload_encrypted_to_s3(
    bucket="my-bucket",
    key="sensitive-data.json",
    data={"secret": "value"},
    kms_key_id="arn:aws:kms:us-east-1:ACCOUNT:key/KEY-ID"
)
```

### Verifying Encryption

```python
from data_encryption import verify_bucket_encryption

# Check encryption status
config = verify_bucket_encryption("my-bucket")
print(f"Encrypted: {config['encrypted']}")
print(f"Algorithm: {config['algorithm']}")
```

## Security Headers

All responses include security headers:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## Monitoring and Logging

### Authentication Logs

All authentication attempts are logged to:
- **DynamoDB**: `B3Dashboard-AuthLogs` table
- **CloudWatch Logs**: `/aws/lambda/auth-service`
- **CloudWatch Metrics**: `B3Dashboard/Authentication`

### Metrics

Monitor these CloudWatch metrics:
- `AuthenticationAttempts` (by type and success)
- `RateLimitExceeded`
- `CSRFValidationFailures`
- `APIKeyRotationNeeded`

### Alerts

Set up CloudWatch alarms for:
- Failed authentication attempts > 10/minute
- Rate limit exceeded > 100/minute
- CSRF validation failures > 5/minute
- Expired API keys still in use

## Security Audit

### Running Audits

```bash
# Manual audit
aws lambda invoke \
  --function-name SecurityAudit \
  --payload '{
    "bucket": "b3-tactical-ranking-data",
    "userPoolId": "us-east-1_XXXXXXXXX"
  }' \
  response.json

# View results
cat response.json
```

### Audit Report

Audit reports include:
- Total findings by severity
- Authentication flow issues
- Authorization control gaps
- Encryption configuration
- API key rotation status
- OWASP Top 10 checks
- Recommendations

### Scheduling Audits

```bash
# Quarterly audits (every 3 months on the 1st)
aws events put-rule \
  --name quarterly-security-audit \
  --schedule-expression "cron(0 0 1 */3 * ? *)" \
  --state ENABLED

aws events put-targets \
  --rule quarterly-security-audit \
  --targets "Id"="1","Arn"="arn:aws:lambda:REGION:ACCOUNT:function:SecurityAudit"
```

## Best Practices

### For Developers

1. **Always use the security middleware** for Lambda handlers
2. **Never log sensitive data** (passwords, tokens, API keys)
3. **Use parameterized queries** to prevent SQL injection
4. **Validate all input** even after sanitization
5. **Follow principle of least privilege** for IAM roles
6. **Rotate secrets regularly** (API keys, database passwords)
7. **Keep dependencies updated** to patch vulnerabilities

### For Administrators

1. **Enable MFA** for all admin users
2. **Review audit logs** regularly
3. **Monitor CloudWatch alarms** for security events
4. **Rotate API keys** before expiration
5. **Conduct security audits** quarterly
6. **Review IAM policies** for overly permissive access
7. **Enable CloudTrail** for API activity logging

### For Users

1. **Use strong passwords** (12+ characters, mixed case, numbers, symbols)
2. **Enable MFA** if available
3. **Don't share API keys** or credentials
4. **Rotate API keys** regularly
5. **Report suspicious activity** immediately
6. **Log out** when finished
7. **Use secure connections** (HTTPS only)

## Compliance

### OWASP Top 10 (2021)

| Risk | Status | Implementation |
|------|--------|----------------|
| A01: Broken Access Control | ✅ | RBAC, authorization checks |
| A02: Cryptographic Failures | ✅ | KMS encryption, TLS 1.3 |
| A03: Injection | ✅ | Input sanitization |
| A04: Insecure Design | ✅ | Security by design |
| A05: Security Misconfiguration | ✅ | Security headers, audits |
| A06: Vulnerable Components | ⚠️ | Dependency scanning needed |
| A07: Auth Failures | ✅ | Cognito, MFA, session timeout |
| A08: Data Integrity Failures | ✅ | Logging, monitoring |
| A09: Logging Failures | ✅ | CloudWatch logs and metrics |
| A10: SSRF | ✅ | Input validation |

### GDPR Considerations

- **Data encryption**: All PII encrypted at rest and in transit
- **Access control**: RBAC limits data access
- **Audit logs**: All access logged for 90 days
- **Data masking**: Sensitive data masked in logs
- **Right to erasure**: User data can be deleted

## Troubleshooting

### Authentication Issues

**Problem**: "Invalid or expired token"
- **Solution**: Token may have expired. Log in again or refresh session.

**Problem**: "API key has expired"
- **Solution**: Rotate the API key using the rotation endpoint.

**Problem**: "Rate limit exceeded"
- **Solution**: Wait for the rate limit window to reset (60 seconds).

### Authorization Issues

**Problem**: "Access denied"
- **Solution**: Check user role. Contact admin to upgrade role if needed.

**Problem**: "CSRF token validation failed"
- **Solution**: Ensure CSRF token is included in request headers.

### Encryption Issues

**Problem**: "Bucket not encrypted"
- **Solution**: Run `enable_bucket_encryption()` to configure encryption.

**Problem**: "KMS key not found"
- **Solution**: Verify KMS key ID in environment variables.

## Support

For security issues or questions:
- **Email**: security@example.com
- **Slack**: #security-team
- **On-call**: PagerDuty escalation

For security vulnerabilities:
- **Report to**: security-vulnerabilities@example.com
- **PGP Key**: Available at https://example.com/pgp
- **Response time**: Within 24 hours
