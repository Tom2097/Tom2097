# Module #1: Multi-Tenant Architecture - Complete Implementation

## Overview

Module #1 implements the foundational multi-tenant architecture for DigiT. This enables complete tenant isolation at the database, cache, and API layers while supporting thousands of independent organizations on a single application instance.

## Architecture

### Core Components

1. **Tenant Context Middleware** (`lib/multitenant/context.ts`)
   - Extracts tenant ID from `X-Tenant-ID` header
   - Validates JWT token claims match tenant ID
   - Wraps API route handlers with tenant validation
   - Returns 401 if tenant context is invalid

2. **Rate Limiting** (`lib/multitenant/rate-limit.ts`)
   - Per-tenant rate limiting (1000 requests/hour, 100 requests/minute)
   - In-memory store with automatic cleanup
   - Returns 429 with Retry-After header when limit exceeded
   - Adds rate limit headers to responses

3. **Database Layer** (`lib/multitenant/database.ts`)
   - Tenant registration with organization creation
   - Auto-creates onboarding progress, API keys, usage tracking
   - Verifies tenant access for users
   - Gets user's accessible tenants

4. **API Endpoints**
   - `POST /api/v1/tenants/register` - Create new tenant/organization
   - `GET /api/v1/tenants/verify` - Verify tenant access
   - `GET /api/v1/tenants/[tenantId]/info` - Get organization info (protected)
   - `PATCH /api/v1/tenants/[tenantId]/info` - Update organization (admin only)

## Database Schema

The following tables support multi-tenancy:

```
organizations (tenants table)
├── id: uuid (primary key)
├── name: string
├── slug: string (unique)
├── created_at: timestamp
└── updated_at: timestamp

profiles
├── id: uuid
├── organization_id: uuid (FK → organizations)
├── email: string
├── full_name: string
├── role: 'admin' | 'member' | 'viewer'
└── ... (other fields)

onboarding_progress
├── id: uuid
├── organization_id: uuid (FK → organizations)
├── current_step: number
├── setup_completed: boolean
└── ... (other fields)

api_keys
├── id: uuid
├── organization_id: uuid (FK → organizations)
├── key_hash: string
├── scopes: string[]
└── ... (other fields)

usage
├── id: uuid
├── organization_id: uuid (FK → organizations)
├── metric: string
├── value: bigint
├── period_start: timestamp
└── period_end: timestamp

[All other business tables have organization_id FK]
```

### Row-Level Security (RLS)

RLS policies on all tables ensure:
- Users can only access data for their organization
- Service role can manage all data
- Tenant ID claims in JWT are validated

## Usage Examples

### 1. Register a New Tenant

```bash
curl -X POST http://localhost:3000/api/v1/tenants/register \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "Acme Corp",
    "email": "admin@acme.com",
    "password": "SecurePass123!",
    "fullName": "John Doe",
    "companyName": "Acme Corporation",
    "industry": "technology"
  }'

# Response (201):
{
  "success": true,
  "data": {
    "tenantId": "org-uuid-here",
    "organizationId": "org-uuid-here",
    "userId": "user-uuid-here",
    "organization": {
      "id": "org-uuid-here",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "createdAt": "2025-01-20T10:00:00Z"
    },
    "jwtToken": "eyJhbGc..."
  }
}
```

### 2. Verify Tenant Access

```bash
curl -X GET http://localhost:3000/api/v1/tenants/verify \
  -H "X-Tenant-ID: org-uuid-here" \
  -H "Authorization: Bearer eyJhbGc..."

# Response (200):
{
  "success": true,
  "data": {
    "tenantId": "org-uuid-here",
    "userId": "user-uuid-here",
    "email": "admin@acme.com",
    "role": "admin"
  }
}
```

### 3. Access Tenant-Protected API Route

```bash
curl -X GET http://localhost:3000/api/v1/tenants/org-uuid-here/info \
  -H "X-Tenant-ID: org-uuid-here" \
  -H "Authorization: Bearer eyJhbGc..."

# Response (200):
{
  "success": true,
  "data": {
    "tenantId": "org-uuid-here",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "user": {
      "userId": "user-uuid-here",
      "email": "admin@acme.com",
      "role": "admin"
    }
  },
  "headers": {
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "98",
    "X-RateLimit-Reset": "45"
  }
}
```

## Creating Tenant-Protected Routes

### Pattern 1: Using `withTenantContext` HOC

```typescript
// app/api/v1/my-route/route.ts
import { withTenantContext, TenantContextMiddleware } from "@/lib/multitenant/context"
import { NextRequest, NextResponse } from "next/server"

async function myHandler(
  request: NextRequest,
  tenantContext: TenantContextMiddleware
) {
  // tenantContext is guaranteed to be valid here
  console.log(`Request from tenant: ${tenantContext.tenantId}`)
  
  return NextResponse.json({ 
    success: true,
    tenantId: tenantContext.tenantId 
  })
}

export const GET = withTenantContext(myHandler)
```

### Pattern 2: Manual Tenant Validation

```typescript
// app/api/v1/manual-route/route.ts
import { extractTenantContext } from "@/lib/multitenant/context"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Manually extract tenant context
  const tenantContext = await extractTenantContext(request)
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check rate limit
  const rateLimitResponse = checkTenantRateLimit(tenantContext.tenantId)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  // Your logic here
  return NextResponse.json({ success: true })
}
```

## Request/Response Headers

### Required Request Headers

For all tenant-protected API routes:

```
X-Tenant-ID: <organization-uuid>
Authorization: Bearer <jwt-token>
```

### Response Headers

All tenant API responses include rate limit information:

```
X-RateLimit-Limit: 100 (requests per minute)
X-RateLimit-Remaining: 95 (requests remaining in current minute)
X-RateLimit-Reset: 45 (seconds until limit resets)
```

Rate limit exceeded (429):

```
Retry-After: 45 (seconds to wait)
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 45
```

## Security Considerations

### 1. Tenant Isolation

- JWT claims must include `tenant_id` matching `X-Tenant-ID` header
- Cross-tenant data access results in 401 Unauthorized
- Audit logs track all cross-tenant access attempts

### 2. Rate Limiting

- Per-tenant rate limits prevent resource exhaustion
- Abuse scoring can trigger account suspension
- In production, upgrade to Redis/Upstash for distributed rate limiting

### 3. API Key Management

- API keys are scoped per tenant and per endpoint
- Keys are hashed in database (never stored plaintext)
- Rotation recommended every 90 days

## Deployment Checklist

- [ ] Verify all tables have `organization_id` foreign key
- [ ] Verify RLS policies are enabled on all business tables
- [ ] Test tenant registration flow end-to-end
- [ ] Test cross-tenant isolation (should fail)
- [ ] Test rate limiting (should return 429)
- [ ] Test rate limit headers in responses
- [ ] Verify JWT validation rejects invalid claims
- [ ] Load test rate limiting under high traffic
- [ ] Enable audit logging for all tenant API calls
- [ ] Configure alerts for repeated 401/403 errors

## Monitoring & Observability

### Key Metrics

- Tenant registration rate
- Rate limit violations per tenant
- Cross-tenant access attempts (security)
- Average response time per tenant
- API key rotation compliance

### Logs to Monitor

- `[v0] Tenant registration complete` - successful onboarding
- `[v0] Tenant access verification failed` - potential unauthorized access
- `[v0] Invalid tenant context` - API misuse
- `[v0] Rate limit cleanup` - rate limit maintenance

## Future Enhancements

1. **Redis Rate Limiting** - Distributed rate limiting for multi-instance deployments
2. **Tenant Usage Analytics** - Track API usage per tenant
3. **Billing Integration** - Enforce usage limits based on subscription tier
4. **Custom Rate Limit Tiers** - Different limits for different subscription plans
5. **Tenant Audit Logging** - Detailed access logs for compliance
6. **API Gateway** - Centralized gateway for all tenant APIs

## Troubleshooting

### Issue: "Missing X-Tenant-ID header"
- Ensure all requests to `/api/v1/tenants/` routes include the header
- Header is case-insensitive but must be spelled exactly

### Issue: "JWT verification failed"
- Check JWT token hasn't expired
- Verify token was issued for the correct tenant
- Check SUPABASE_JWT_SECRET environment variable is set

### Issue: "Rate limit exceeded"
- Wait for Retry-After seconds before retrying
- Check if this tenant has exceeded quota
- Contact support to increase rate limits

### Issue: "Cross-tenant data leak"
- Verify RLS policies are active on all tables
- Check organization_id filtering in database queries
- Enable audit logging to track which user accessed which data
