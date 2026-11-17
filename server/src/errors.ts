/**
 * Typed domain errors. Each carries the HTTP status the error middleware
 * (Phase 3) will send, so routes never have to map errors by hand.
 * Messages are safe to show to the client: they never mention other users' swipes.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class SelfSwipeError extends AppError {
  constructor() {
    super('You cannot swipe on yourself', 400, 'SELF_SWIPE');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Profile not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class AlreadySwipedError extends AppError {
  constructor() {
    super('You have already swiped on this profile', 409, 'ALREADY_SWIPED');
  }
}
