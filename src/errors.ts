export class EZUnsubError extends Error {
  public readonly statusCode?: number

  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = 'EZUnsubError'
    this.statusCode = statusCode
  }
}

export class AuthenticationError extends EZUnsubError {
  constructor(message = 'Authentication required') {
    super(message, 401)
    this.name = 'AuthenticationError'
  }
}

export class ValidationError extends EZUnsubError {
  constructor(message = 'Invalid request') {
    super(message, 400)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends EZUnsubError {
  constructor(message = 'Resource not found') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

export class RateLimitError extends EZUnsubError {
  public readonly retryAfter?: number

  constructor(message = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

export class ForbiddenError extends EZUnsubError {
  constructor(message = 'Access denied') {
    super(message, 403)
    this.name = 'ForbiddenError'
  }
}
