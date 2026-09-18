
import type {
 AIProvider
} from "./model.types";


export interface ModelProvider {

 name:AIProvider;

 generate(
  prompt:string
 ):Promise<string>;

}

