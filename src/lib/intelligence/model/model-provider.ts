import type { AIProvider } from "./model.types";
import type { ModelRequest } from "./model-request";
import type { ModelResponse } from "./model-response";

export interface ModelProvider {

 name: AIProvider;

 generate(
   request: ModelRequest
 ): Promise<ModelResponse>;

}
