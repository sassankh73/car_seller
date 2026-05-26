# Stripe Configuration for AutoStudio AI

## Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Stripe API Keys (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Frontend URL (for redirect after checkout)
FRONTEND_URL=http://localhost:3000

# For production:
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_PUBLISHABLE_KEY=pk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
# FRONTEND_URL=https://autostudio.ai
```

## Stripe Dashboard Setup

### 1. Create Products & Prices

Go to Stripe Dashboard → Products → Add Product

#### Basic Plan
- **Name**: AutoStudio Basic
- **Description**: 20 generations/month, HD export, 1 studio
- **Pricing**: 
  - Monthly: $29.00
  - Yearly: $290.00
- **Price IDs** (after creation):
  - `price_basic_monthly` → replace in `billing.py`
  - `price_basic_yearly` → replace in `billing.py`

#### Professional Plan
- **Name**: AutoStudio Professional
- **Description**: 100 generations/month, 4K export, 3 studios, logo branding, premium AI
- **Pricing**:
  - Monthly: $79.00
  - Yearly: $790.00
- **Price IDs**:
  - `price_pro_monthly`
  - `price_pro_yearly`

#### Enterprise Plan
- **Name**: AutoStudio Enterprise
- **Description**: Unlimited generations, 4K export, all studios, API access, dedicated support
- **Pricing**:
  - Monthly: $199.00
  - Yearly: $1990.00
- **Price IDs**:
  - `price_enterprise_monthly`
  - `price_enterprise_yearly`

### 2. Configure Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. **Endpoint URL**: `https://your-domain.com/api/billing/webhook`
4. **Events to listen to**:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Save and copy the **Signing Secret** → `STRIPE_WEBHOOK_SECRET`

### 3. Customer Portal Configuration

1. Go to Stripe Dashboard → Settings → Customer Portal
2. Enable the portal
3. Configure:
   - Allow customers to update payment methods
   - Allow customers to cancel subscriptions
   - Allow customers to switch plans
4. Add your branding (logo, colors)

### 4. Test the Integration

#### Test Mode Cards

Use these test card numbers in Stripe Checkout:

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 9995 | Declined (insufficient funds) |
| 4000 0000 0000 3220 | Requires authentication (3DS) |

#### Test Webhooks Locally

Use Stripe CLI to forward webhooks to your local server:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://github.com/stripe/stripe-cli/releases

# Login to Stripe
stripe login

# Forward webhooks to localhost:8000
stripe listen --forward-to localhost:8000/api/billing/webhook
```

## API Endpoints

### List Plans
```bash
GET /api/billing/plans
```

### Get Specific Plan
```bash
GET /api/billing/plans/{tier}
# tier: basic, professional, enterprise
```

### Create Checkout Session
```bash
POST /api/billing/checkout
Content-Type: application/json

{
  "plan_tier": "professional",
  "billing_cycle": "monthly",
  "user_email": "user@example.com",
  "user_id": "user_123"
}

# Response:
{
  "checkout_url": "https://checkout.stripe.com/...",
  "session_id": "cs_..."
}
```

### Customer Portal
```bash
GET /api/billing/portal?stripe_customer_id=cus_123

# Response:
{
  "portal_url": "https://billing.stripe.com/..."
}
```

### Webhook (Stripe → Your Server)
```bash
POST /api/billing/webhook
Headers:
  stripe-signature: t=...,v1=...
```

### Usage Tracking
```bash
# Get current usage
GET /api/billing/usage/{user_id}

# Record usage
POST /api/billing/usage/{user_id}/record
  ?generation=true
  &extra_studio=false
  &logo_branding=false
  &premium_ai=true
  &export_4k=false

# Calculate overage costs
POST /api/billing/calculate-cost
Content-Type: application/json

{
  "user_id": "user_123",
  "plan_tier": "professional",
  "extra_studios": 2,
  "logo_branding": true,
  "premium_ai": false,
  "export_4k": true
}
```

## Pricing Logic

### Subscription Plans

| Feature | Basic | Professional | Enterprise |
|---------|-------|--------------|------------|
| **Price (Monthly)** | $29 | $79 | $199 |
| **Price (Yearly)** | $290 | $790 | $1990 |
| Generations/Month | 20 | 100 | Unlimited |
| Max Resolution | HD | 4K | 4K |
| Studios Included | 1 | 3 | 4 |
| Logo Branding | ❌ | ✅ | ✅ |
| Premium AI | ❌ | ✅ | ✅ |
| Priority Processing | ❌ | ✅ | ✅ |
| Support | Email | Priority | Dedicated |
| API Access | ❌ | ❌ | ✅ |
| Batch Processing | ❌ | ❌ | ✅ |

### Usage-Based Overage Charges

| Item | Price | Notes |
|------|-------|-------|
| Extra Generation | $3.00 | Beyond monthly limit |
| Extra Studio | $3-5 | Per studio beyond included |
| Logo Branding | $10.00 | Per generation (Basic only) |
| Premium AI | $2.00 | Per use (Basic only) |
| 4K Export | $5.00 | Per export (Basic only) |

## Production Checklist

- [ ] Replace test Stripe keys with live keys
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Configure production webhook endpoint
- [ ] Test checkout flow with live cards
- [ ] Set up email notifications for payment events
- [ ] Configure tax settings in Stripe
- [ ] Set up dunning (failed payment recovery)
- [ ] Add subscription metrics to analytics dashboard
- [ ] Implement proper user authentication
- [ ] Connect billing to user database

## Security Notes

1. **Never expose secret keys** in frontend code
2. **Always verify webhook signatures** before processing
3. **Use HTTPS** for all production endpoints
4. **Store customer IDs** securely in your database
5. **Implement rate limiting** on billing endpoints
