/**
 * @typedef {'INVALID_REQUEST' | 'NOT_FOUND' | 'ORDER_NOT_CANCELLABLE' | 'RESOURCE_CONFLICT' | 'INTERNAL_SERVER_ERROR'} ErrorCode
 */

export class AppError extends Error {
  /**
   * @param {number} status
   * @param {ErrorCode} code
   * @param {string} message
   * @param {string[]} [details]
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class InvalidRequestError extends AppError {
  /**
   * @param {string[]} [details]
   * @param {string} [message]
   */
  constructor(details, message = 'Invalid request') {
    super(400, 'INVALID_REQUEST', message, details);
  }
}

export class NotFoundError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class OrderNotCancellableError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Only orders in NEW status can be cancelled') {
    super(409, 'ORDER_NOT_CANCELLABLE', message);
  }
}

export class ResourceConflictError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Resource conflict') {
    super(409, 'RESOURCE_CONFLICT', message);
  }
}
