export { EZUnsubClient, type EZUnsubClientOptions } from './client'
export { WebhookVerifier, type WebhookPayload, type WebhookEvent } from './webhook'
export {
  EZUnsubError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ForbiddenError,
} from './errors'
export type {
  Contact,
  Webhook,
  WebhookDelivery,
  Link,
  Offer,
  Export,
  ContactStats,
  PiiMode,
} from './types'
