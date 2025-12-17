# EZUnsub TypeScript SDK

Official TypeScript SDK for [EZUnsub](https://ezunsub.com) - Contact suppression and unsubscribe management for affiliate marketing compliance.

## Installation

```bash
# npm
npm install @ezunsub/sdk

# bun
bun add @ezunsub/sdk

# pnpm
pnpm add @ezunsub/sdk
```

## Quick Start

```typescript
import { EZUnsubClient } from '@ezunsub/sdk'

// Initialize client
const client = new EZUnsubClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-ezunsub-instance.com'
})

// List contacts
const contacts = await client.contacts.list({ page: 1, limit: 50 })

// Get contact statistics
const stats = await client.contacts.stats()
console.log(`Total contacts: ${stats.total}`)

// Create a webhook
const webhook = await client.webhooks.create({
  name: 'My Webhook',
  url: 'https://my-app.com/webhooks/ezunsub',
  events: ['contact.created', 'contact.updated']
})
console.log(`Webhook secret (save this!): ${webhook.secret}`)
```

## Webhook Verification

Verify incoming webhooks from EZUnsub:

```typescript
import { WebhookVerifier } from '@ezunsub/sdk'

const verifier = new WebhookVerifier('your-webhook-secret')

// Hono example
app.post('/webhooks/ezunsub', async (c) => {
  const signature = c.req.header('X-Webhook-Signature') ?? ''
  const timestamp = c.req.header('X-Webhook-Timestamp') ?? ''
  const deliveryId = c.req.header('X-Webhook-Delivery-Id') ?? ''
  const body = await c.req.text()

  try {
    const payload = verifier.verifyAndParse({
      signature,
      timestamp,
      body,
      deliveryId,
    })

    switch (payload.event) {
      case 'contact.created':
        await handleNewContact(payload.data)
        break
      case 'contact.updated':
        await handleContactUpdate(payload.data)
        break
      case 'export.completed':
        await handleExportComplete(payload.data)
        break
    }

    return c.json({ status: 'ok' })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400)
  }
})
```

### Express Example

```typescript
import express from 'express'
import { WebhookVerifier } from '@ezunsub/sdk'

const app = express()
const verifier = new WebhookVerifier('your-webhook-secret')

// Important: Use raw body for signature verification
app.post('/webhooks/ezunsub', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const { signature, timestamp, deliveryId } = WebhookVerifier.extractHeaders(req.headers)

    const payload = verifier.verifyAndParse({
      signature,
      timestamp,
      body: req.body.toString(),
      deliveryId,
    })

    if (payload.event === 'contact.created') {
      console.log('New contact:', payload.data.emailHash)
    }

    res.json({ status: 'ok' })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
})
```

## API Reference

### Client

```typescript
import { EZUnsubClient } from '@ezunsub/sdk'

const client = new EZUnsubClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-ezunsub-instance.com', // optional
  timeout: 30000, // optional, default 30s
})
```

### Contacts

```typescript
// List contacts
const contacts = await client.contacts.list({ page: 1, limit: 50, linkCode: 'abc123' })

// Get single contact (admin only)
const contact = await client.contacts.get('contact-id')

// Delete contact (admin only)
await client.contacts.delete('contact-id')

// Get statistics
const stats = await client.contacts.stats()
```

### Webhooks

```typescript
// List webhooks
const webhooks = await client.webhooks.list()

// Create webhook
const webhook = await client.webhooks.create({
  name: 'My Webhook',
  url: 'https://example.com/webhook',
  events: ['contact.created', 'contact.updated'],
  piiMode: 'hashes', // 'full' | 'hashes' | 'none'
})

// Update webhook
await client.webhooks.update('webhook-id', { isActive: false })

// Delete webhook
await client.webhooks.delete('webhook-id')

// Rotate secret
const newWebhook = await client.webhooks.rotateSecret('webhook-id')

// Send test
const result = await client.webhooks.test('webhook-id')

// Get delivery history
const deliveries = await client.webhooks.deliveries('webhook-id', { limit: 50 })

// Get available events
const events = await client.webhooks.events()
```

### Links

```typescript
// List links
const links = await client.links.list({ offerId: 'offer-id' })

// Get link
const link = await client.links.get('link-code')

// Create link
const link = await client.links.create({ offerId: 'offer-id', name: 'My Link' })
```

### Offers

```typescript
// List offers
const offers = await client.offers.list()

// Get offer
const offer = await client.offers.get('offer-id')
```

### Exports

```typescript
// List exports
const exports = await client.exports.list()

// Get export
const exportJob = await client.exports.get('export-id')

// Create export
const exportJob = await client.exports.create({
  name: 'My Export',
  filters: { status: 'suppressed' },
})
```

## Webhook Events

| Event | Description |
|-------|-------------|
| `contact.created` | New contact added to suppression list |
| `contact.updated` | Contact record updated |
| `complaint.created` | New complaint filed |
| `complaint.updated` | Complaint status changed |
| `link.created` | New unsubscribe link created |
| `link.clicked` | Unsubscribe link was clicked |
| `export.completed` | Export job finished |

## Webhook Payload

All webhooks include these headers:

| Header | Description |
|--------|-------------|
| `X-Webhook-Signature` | HMAC-SHA256 signature (`sha256=...`) |
| `X-Webhook-Timestamp` | Unix timestamp |
| `X-Webhook-Event` | Event type |
| `X-Webhook-Delivery-Id` | Unique delivery ID |

Payload structure:

```typescript
interface WebhookPayload {
  event: string
  timestamp: string // ISO 8601
  data: {
    contactId?: string
    linkCode?: string
    emailHash?: string
    phoneHash?: string
    email?: string // only if piiMode is 'full'
    phone?: string // only if piiMode is 'full'
    status?: string
    // ... other event-specific fields
  }
}
```

## Error Handling

```typescript
import {
  EZUnsubClient,
  EZUnsubError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
} from '@ezunsub/sdk'

const client = new EZUnsubClient({ apiKey: 'your-api-key' })

try {
  const contact = await client.contacts.get('invalid-id')
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Invalid API key')
  } else if (error instanceof NotFoundError) {
    console.log('Contact not found')
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited, retry after ${error.retryAfter} seconds`)
  } else if (error instanceof ValidationError) {
    console.log(`Invalid request: ${error.message}`)
  } else if (error instanceof EZUnsubError) {
    console.log(`API error: ${error.message} (status: ${error.statusCode})`)
  }
}
```

## Types

The SDK exports TypeScript types for all API responses:

```typescript
import type {
  Contact,
  ContactStats,
  Webhook,
  WebhookDelivery,
  Link,
  Offer,
  Export,
  PiiMode,
  WebhookEvent,
} from '@ezunsub/sdk'
```

## License

MIT
