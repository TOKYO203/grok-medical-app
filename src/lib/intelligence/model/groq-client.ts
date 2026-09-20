/** Compatibility entrypoint: provider credentials never reach the browser. */
export { streamClinicalAI as streamAI } from "@/lib/ai/client-stream";
export type { AIStreamBody as AIRequest } from "@/lib/ai/schemas";
