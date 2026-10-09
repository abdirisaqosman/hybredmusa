import type { StatusCode } from "hono/utils/http-status";

/** Every error response the API sends has this shape. */
export class ApiException extends Error {
  readonly status: StatusCode;
  readonly code: string;

  constructor(status: StatusCode, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST") =>
  new ApiException(400, code, message);

export const unauthorized = (message = "Authentication required", code = "UNAUTHORIZED") =>
  new ApiException(401, code, message);

export const forbidden = (message = "Not allowed", code = "FORBIDDEN") =>
  new ApiException(403, code, message);

export const notFound = (message = "Not found", code = "NOT_FOUND") =>
  new ApiException(404, code, message);

export const conflict = (message: string, code = "CONFLICT") =>
  new ApiException(409, code, message);

export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}
