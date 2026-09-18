export type IntelligenceDomain =
  | "agents"
  | "reasoning"
  | "memory"
  | "workflow"
  | "copilot";


export interface IntelligenceCapability {
  id: string;
  name: string;
  domain: IntelligenceDomain;
  description: string;
  enabled: boolean;
}


export interface IntelligenceRequest {
  domain: IntelligenceDomain;
  action: string;
  payload?: unknown;
}


export interface IntelligenceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
