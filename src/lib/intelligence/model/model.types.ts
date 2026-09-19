export type AIProvider =
  | "ollama"
  | "openai"
  | "mistral"
  | "deepseek"
  | "openrouter"
  | "groq"
  | "unknown";

export interface AIRequest {
  id: string;
  prompt: string;
  model?: string;
  task?: string;
  systemPrompt?: string;
  temperature?: number;
}

export interface AIResponse {
  success: boolean;
  provider: AIProvider;
  content?: string;
  error?: string;
}
