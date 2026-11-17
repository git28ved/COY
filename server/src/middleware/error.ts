import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors.js';

/** JSON 404 for any route that doesn't exist. */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
};

/**
 * Maps every error to a safe JSON response:
 * - ZodError → 400, listing which fields are wrong (only the client's own input)
 * - AppError (typed domain errors) → its own status and message
 * - body-parser errors (malformed JSON, body too large) → their 4xx status
 * - anything else → generic 500. The details are logged on the server and never
 *   sent to the client (no stack traces, no SQL).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Invalid request',
      code: 'VALIDATION_ERROR',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  if (isBodyParserError(err)) {
    const tooLarge = err.type === 'entity.too.large';
    res.status(err.status).json({
      error: tooLarge ? 'Request body too large' : 'Malformed JSON body',
      code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'BAD_JSON',
    });
    return;
  }

  console.error('[server] unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong', code: 'INTERNAL' });
};

function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    typeof err.type === 'string' &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  );
}
