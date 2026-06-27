// Domain errors thrown by the service layer; mapped to HTTP by the handler wrapper.
export class AppError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "AppError";
  }
}
export class NotFoundError extends AppError {
  constructor(entity = "Resource") { super(`${entity} not found`, 404); }
}
export class ConflictError extends AppError {
  constructor(message: string) { super(message, 409); }
}
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") { super(message, 403); }
}
