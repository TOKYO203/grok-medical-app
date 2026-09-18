export interface ContextRequest {
  userId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ContextInput {
  userId?: string;
  message?: string;
  data?: unknown;
}

export interface OptimusContext {
  userId: string;
  message?: string;
  timestamp: string;
  data?: unknown;
}
