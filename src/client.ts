import {
  EZUnsubError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ForbiddenError,
} from './errors'
import type {
  Contact,
  ContactStats,
  Webhook,
  WebhookDelivery,
  Link,
  Offer,
  Export,
  PiiMode,
  WebhookEventType,
  PaginatedResponse,
} from './types'

export interface EZUnsubClientOptions {
  apiKey: string
  baseUrl?: string
  timeout?: number
}

/**
 * EZUnsub API Client
 *
 * @example
 * ```typescript
 * import { EZUnsubClient } from '@ezunsub/sdk'
 *
 * const client = new EZUnsubClient({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://your-ezunsub-instance.com'
 * })
 *
 * // List contacts
 * const contacts = await client.contacts.list()
 *
 * // Create webhook
 * const webhook = await client.webhooks.create({
 *   name: 'My Webhook',
 *   url: 'https://my-app.com/webhooks/ezunsub',
 *   events: ['contact.created', 'contact.updated']
 * })
 * ```
 */
export class EZUnsubClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeout: number

  public readonly contacts: ContactsResource
  public readonly webhooks: WebhooksResource
  public readonly links: LinksResource
  public readonly offers: OffersResource
  public readonly exports: ExportsResource

  constructor(options: EZUnsubClientOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl ?? 'https://api.ezunsub.com').replace(/\/$/, '')
    this.timeout = options.timeout ?? 30000

    this.contacts = new ContactsResource(this)
    this.webhooks = new WebhooksResource(this)
    this.links = new LinksResource(this)
    this.offers = new OffersResource(this)
    this.exports = new ExportsResource(this)
  }

  async request<T>(
    method: string,
    path: string,
    options?: {
      json?: Record<string, unknown>
      params?: Record<string, string | number | boolean | undefined>
    }
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)

    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'ezunsub-typescript/0.1.0',
        },
        body: options?.json ? JSON.stringify(options.json) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return this.handleResponse<T>(response)
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof EZUnsubError) throw error
      throw new EZUnsubError(`Request failed: ${(error as Error).message}`)
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      throw new AuthenticationError()
    }
    if (response.status === 403) {
      const data = await this.parseJson(response)
      throw new ForbiddenError(data?.error ?? 'Access denied')
    }
    if (response.status === 404) {
      const data = await this.parseJson(response)
      throw new NotFoundError(data?.error ?? 'Resource not found')
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      throw new RateLimitError(
        'Rate limit exceeded',
        retryAfter ? parseInt(retryAfter, 10) : undefined
      )
    }
    if (response.status === 400) {
      const data = await this.parseJson(response)
      throw new ValidationError(data?.error ?? 'Invalid request')
    }
    if (response.status >= 400) {
      const data = await this.parseJson(response)
      throw new EZUnsubError(
        data?.error ?? `Request failed with status ${response.status}`,
        response.status
      )
    }

    if (response.status === 204) {
      return {} as T
    }

    const text = await response.text()
    if (!text) return {} as T

    return JSON.parse(text) as T
  }

  private async parseJson(response: Response): Promise<{ error?: string } | null> {
    try {
      const text = await response.text()
      return text ? JSON.parse(text) : null
    } catch {
      return null
    }
  }
}

class ContactsResource {
  constructor(private client: EZUnsubClient) {}

  async list(options?: {
    page?: number
    limit?: number
    linkCode?: string
  }): Promise<Contact[]> {
    return this.client.request<Contact[]>('GET', '/api/contacts', {
      params: {
        page: options?.page ?? 1,
        limit: options?.limit ?? 50,
        linkCode: options?.linkCode,
      },
    })
  }

  async get(contactId: string): Promise<Contact> {
    return this.client.request<Contact>('GET', `/api/contacts/${contactId}`)
  }

  async delete(contactId: string): Promise<{ success: boolean }> {
    return this.client.request('DELETE', `/api/contacts/${contactId}`)
  }

  async stats(): Promise<ContactStats> {
    return this.client.request<ContactStats>('GET', '/api/contacts/stats')
  }
}

class WebhooksResource {
  constructor(private client: EZUnsubClient) {}

  async list(orgId?: string): Promise<Webhook[]> {
    return this.client.request<Webhook[]>('GET', '/api/webhooks', {
      params: { orgId },
    })
  }

  async get(webhookId: string): Promise<Webhook> {
    return this.client.request<Webhook>('GET', `/api/webhooks/${webhookId}`)
  }

  async create(options: {
    name: string
    url: string
    events: WebhookEventType[]
    piiMode?: PiiMode
    orgId?: string
  }): Promise<Webhook> {
    return this.client.request<Webhook>('POST', '/api/webhooks', {
      json: {
        name: options.name,
        url: options.url,
        events: options.events,
        piiMode: options.piiMode ?? 'hashes',
        orgId: options.orgId,
      },
    })
  }

  async update(
    webhookId: string,
    options: {
      name?: string
      url?: string
      events?: WebhookEventType[]
      piiMode?: PiiMode
      isActive?: boolean
    }
  ): Promise<Webhook> {
    return this.client.request<Webhook>('PATCH', `/api/webhooks/${webhookId}`, {
      json: options,
    })
  }

  async delete(webhookId: string): Promise<{ success: boolean }> {
    return this.client.request('DELETE', `/api/webhooks/${webhookId}`)
  }

  async rotateSecret(webhookId: string): Promise<Webhook> {
    return this.client.request<Webhook>('POST', `/api/webhooks/${webhookId}/rotate-secret`)
  }

  async test(webhookId: string): Promise<{
    success: boolean
    status?: number
    statusText?: string
    responseBody?: string
    error?: string
  }> {
    return this.client.request('POST', `/api/webhooks/${webhookId}/test`)
  }

  async deliveries(
    webhookId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<PaginatedResponse<WebhookDelivery>> {
    return this.client.request('GET', `/api/webhooks/${webhookId}/deliveries`, {
      params: {
        limit: options?.limit ?? 50,
        offset: options?.offset ?? 0,
      },
    })
  }

  async events(): Promise<{ events: WebhookEventType[]; piiModes: PiiMode[] }> {
    return this.client.request('GET', '/api/webhooks/events/list')
  }
}

class LinksResource {
  constructor(private client: EZUnsubClient) {}

  async list(options?: {
    page?: number
    limit?: number
    offerId?: string
  }): Promise<Link[]> {
    return this.client.request<Link[]>('GET', '/api/links', {
      params: {
        page: options?.page ?? 1,
        limit: options?.limit ?? 50,
        offerId: options?.offerId,
      },
    })
  }

  async get(code: string): Promise<Link> {
    return this.client.request<Link>('GET', `/api/links/${code}`)
  }

  async create(options: { offerId: string; name?: string }): Promise<Link> {
    return this.client.request<Link>('POST', '/api/links', {
      json: options,
    })
  }
}

class OffersResource {
  constructor(private client: EZUnsubClient) {}

  async list(options?: { page?: number; limit?: number }): Promise<Offer[]> {
    return this.client.request<Offer[]>('GET', '/api/offers', {
      params: {
        page: options?.page ?? 1,
        limit: options?.limit ?? 50,
      },
    })
  }

  async get(offerId: string): Promise<Offer> {
    return this.client.request<Offer>('GET', `/api/offers/${offerId}`)
  }
}

class ExportsResource {
  constructor(private client: EZUnsubClient) {}

  async list(options?: { page?: number; limit?: number }): Promise<Export[]> {
    return this.client.request<Export[]>('GET', '/api/exports', {
      params: {
        page: options?.page ?? 1,
        limit: options?.limit ?? 50,
      },
    })
  }

  async get(exportId: string): Promise<Export> {
    return this.client.request<Export>('GET', `/api/exports/${exportId}`)
  }

  async create(options: {
    name: string
    filters?: Record<string, unknown>
    format?: string
  }): Promise<Export> {
    return this.client.request<Export>('POST', '/api/exports', {
      json: {
        name: options.name,
        filters: options.filters,
        format: options.format ?? 'csv',
      },
    })
  }
}
