import type {
  IntelligenceCapability
} from "./intelligence-types";


export const intelligenceRegistry: IntelligenceCapability[] = [

  {
    id: "clinical-agents",
    name: "Clinical Autonomous Agents",
    domain: "agents",
    description:
      "Coordination layer for autonomous clinical agents",
    enabled: true
  },

  {
    id: "clinical-reasoning",
    name: "Clinical Reasoning Engine",
    domain: "reasoning",
    description:
      "Differential reasoning and evidence ranking orchestration",
    enabled: true
  },

  {
    id: "memory-system",
    name: "OPTIMUS Memory System",
    domain: "memory",
    description:
      "Long term intelligence memory abstraction",
    enabled: true
  },

  {
    id: "workflow-ai",
    name: "Workflow Intelligence",
    domain: "workflow",
    description:
      "AI workflow automation layer",
    enabled: true
  },

  {
    id: "copilot",
    name: "Clinical Copilot",
    domain: "copilot",
    description:
      "Premium AI assistant interface",
    enabled: true
  }

];


export function getIntelligenceRegistry() {
  return intelligenceRegistry;
}


export function getCapability(id: string) {

  return intelligenceRegistry.find(
    item => item.id === id
  );

}
