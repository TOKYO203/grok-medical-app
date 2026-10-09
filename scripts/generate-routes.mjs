import process from "node:process";
import { Generator, getConfig } from "@tanstack/router-generator";

const root = process.cwd();

/**
 * Le plugin TanStack Start ajoute un « footer » au route tree généré : les imports
 * de types et l'augmentation du module `@tanstack/react-start` (`interface Register`).
 *
 * Le générateur autonome (`@tanstack/router-generator`) ne l'ajoute PAS tout seul —
 * il faut donc lui fournir exactement le même footer que le plugin
 * (`@tanstack/start-plugin-core/start-router-plugin/route-tree-footer`), sinon
 * `npm run routes:generate` réécrit `src/routeTree.gen.ts` en supprimant le bloc
 * `Register` et laisse l'arbre de routes désynchronisé (release:check sale).
 */
const ROUTE_TREE_FOOTER = [
  // Un unique élément : le générateur joint les entrées du footer avec une ligne
  // vide, alors que le plugin Start colle ses blocs avec un simple saut de ligne.
  [
    `import type { getRouter } from './router.tsx'`,
    `import type { createStart } from '@tanstack/react-start'`,
    `declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}`,
  ].join("\n"),
];

const config = getConfig(
  {
    target: "react",
    routesDirectory: "./src/routes",
    generatedRouteTree: "./src/routeTree.gen.ts",
    disableLogging: true,
    routeTreeFileFooter: ROUTE_TREE_FOOTER,
  },
  root,
);

const generator = new Generator({ config, root });
await generator.run();
