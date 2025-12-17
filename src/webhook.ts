import { createHmac, timingSafeEqual } from 'crypto'
import type { WebhookEventType } from './types'

export type WebhookEvent = WebhookEventType

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
  deliveryId: string
}

/**
 * Verify and parse EZUnsub webhook payloads
 *
 * @example
 * ```typescript
 * import { WebhookVerifier } from '@ezunsub/sdk'
 *
 * const verifier = new WebhookVerifier('your-webhook-secret')
 *
 * // In your webhook handler (e.g., Express/Hono)
 * app.post('/webhooks/ezunsub', async (req, res) => {
 *   const signature = req.headers['x-webhook-signature'] as string
 *   const timestamp = req.headers['x-webhook-timestamp'] as string
 *   const deliveryId = req.headers['x-webhook-delivery-id'] as string
 *   const body = await req.text() // raw body
 *
 *   try {
 *     const payload = verifier.verifyAndParse({
 *       signature,
 *       timestamp,
 *       body,
 *       deliveryId,
 *     })
 *
 *     if (payload.event === 'contact.created') {
 *       console.log('New contact:', payload.data.emailHash)
 *     }
 *
 *     return { status: 'ok' }
 *   } catch (error) {
 *     return Response.json({ error: error.message }, { status: 400 })
 *   }
 * })
 * ```
 */
export class WebhookVerifier {
  private readonly secret: string
  private readonly maxAgeSeconds: number

  constructor(secret: string, maxAgeSeconds = 300) {
    this.secret = secret
    this.maxAgeSeconds = maxAgeSeconds
  }

  /**
   * Verify webhook signature
   */
  verifySignature(signature: string, timestamp: number, body: string): boolean {
    // Check timestamp is within acceptable range
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - timestamp) > this.maxAgeSeconds) {
      return false
    }

    // Calculate expected signature
    const message = `${timestamp}.${body}`
    const expected = createHmac('sha256', this.secret).update(message).digest('hex')

    // Extract signature value (remove "sha256=" prefix if present)
    const sigValue = signature.startsWith('sha256=') ? signature.slice(7) : signature

    // Use timing-safe comparison
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(sigValue))
    } catch {
      return false
    }
  }

  /**
   * Verify signature and parse webhook payload
   */
  verifyAndParse(options: {
    signature: string
    timestamp: string | number
    body: string
    deliveryId?: string
  }): WebhookPayload {
    const ts = typeof options.timestamp === 'string'
      ? parseInt(options.timestamp, 10)
      : options.timestamp

    // Verify signature
    if (!this.verifySignature(options.signature, ts, options.body)) {
      throw new Error('Invalid webhook signature')
    }

    // Parse body
    let data: Record<string, unknown>
    try {
      data = JSON.parse(options.body)
    } catch (e) {
      throw new Error(`Invalid JSON payload: ${(e as Error).message}`)
    }

    // Validate required fields
    if (!data.event) {
      throw new Error("Missing 'event' field in payload")
    }
    if (!data.timestamp) {
      throw new Error("Missing 'timestamp' field in payload")
    }
    if (!data.data) {
      throw new Error("Missing 'data' field in payload")
    }

    return {
      event: data.event as WebhookEvent,
      timestamp: data.timestamp as string,
      data: data.data as Record<string, unknown>,
      deliveryId: options.deliveryId ?? '',
    }
  }

  /**
   * Extract webhook headers from a request
   */
  static extractHeaders(headers: Headers | Record<string, string>): {
    signature: string
    timestamp: string
    event: string
    deliveryId: string
  } {
    const get = (key: string): string | null => {
      if (headers instanceof Headers) {
        return headers.get(key)
      }
      // Handle case-insensitive lookup for plain objects
      const lowerKey = key.toLowerCase()
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === lowerKey) return v
      }
      return null
    }

    const signature = get('x-webhook-signature')
    const timestamp = get('x-webhook-timestamp')
    const event = get('x-webhook-event')
    const deliveryId = get('x-webhook-delivery-id')

    if (!signature) {
      throw new Error('Missing X-Webhook-Signature header')
    }
    if (!timestamp) {
      throw new Error('Missing X-Webhook-Timestamp header')
    }

    return {
      signature,
      timestamp,
      event: event ?? '',
      deliveryId: deliveryId ?? '',
    }
  }
}
