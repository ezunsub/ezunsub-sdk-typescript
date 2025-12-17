export type PiiMode = 'full' | 'hashes' | 'none'

export type WebhookEventType =
  | 'contact.created'
  | 'contact.updated'
  | 'complaint.created'
  | 'complaint.updated'
  | 'link.created'
  | 'link.clicked'
  | 'export.completed'
  | 'test'

export interface Contact {
  id: string
  email: string | null
  emailHash: string | null
  phone: string | null
  phoneHash: string | null
  ip: string | null
  country: string | null
  userAgent: string | null
  linkCode: string | null
  status: string
  attemptCount: number
  customParams: Record<string, string> | null
  createdAt: string
  updatedAt: string | null
  offerName?: string
  userName?: string
}

export interface ContactStats {
  total: number
  emails: number
  phones: number
  global: number
}

export interface Webhook {
  id: string
  orgId: string
  name: string
  url: string
  secret: string
  events: WebhookEventType[]
  piiMode: PiiMode
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  event: WebhookEventType
  payload: Record<string, unknown>
  status: 'pending' | 'success' | 'failed'
  attempts: number
  lastAttemptAt: string | null
  responseStatus: number | null
  responseBody: string | null
  nextRetryAt: string | null
  createdAt: string
}

export interface Link {
  id: string
  code: string
  name: string | null
  offerId: string
  orgId: string
  userId: string
  createdAt: string
  updatedAt: string | null
  offerName?: string
  userName?: string
}

export interface Offer {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface Export {
  id: string
  name: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  filters: Record<string, unknown> | null
  format: string
  fileUrl: string | null
  rowCount: number | null
  createdAt: string
  completedAt: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    limit: number
    offset: number
    hasMore: boolean
  }
}
