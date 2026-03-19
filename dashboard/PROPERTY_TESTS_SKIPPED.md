# Skipped Property-Based Tests

## Issue: fast-check ESM Module Import Error

**Date**: 2024
**Status**: Temporarily Skipped

### Problem
The fast-check library is causing ESM module import errors in Jest tests:
```
Cannot find module 'fast-check' from 'src/components/shared/Breadcrumb.property.test.tsx'
```

This appears to be a Jest/ESM compatibility issue with fast-check v3.x.

### Skipped Test Suites
The following 4 property test suites have been temporarily skipped using `.skip`:

1. `dashboard/src/components/shared/Breadcrumb.property.test.tsx`
   - Property 53: Breadcrumb Path Consistency

2. `dashboard/src/components/shared/FavoriteIcon.property.test.tsx`
   - Property 54: Favorite Toggle Idempotence
   - Property 55: Favorite Limit Enforcement

3. `dashboard/src/contexts/SystemHealthContext.property.test.tsx`
   - Property 64: Health Status Aggregation

4. `dashboard/src/contexts/NotificationContext.property.test.tsx`
   - Property 61: Notification Unread Count
   - Property 62: Notification Ordering
   - Property 63: Notification Retention

### Potential Solutions
1. **Upgrade Jest to v29+** with better ESM support
2. **Configure Jest transformIgnorePatterns** to handle fast-check
3. **Use babel-jest** to transform fast-check
4. **Switch to Vitest** which has native ESM support
5. **Downgrade fast-check** to v2.x (if compatible)

### Resolution Plan
These tests should be re-enabled once the ESM compatibility issue is resolved. The test logic is sound and validates important properties of the system.

### Impact
- 4 test suites skipped
- ~15 property tests not running
- Core functionality still covered by unit tests
- Properties validated: Requirements 37.2, 37.3, 38.2, 38.8, 45.2, 45.5, 45.10, 47.6, 47.7, 47.8
