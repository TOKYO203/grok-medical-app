import process from "node:process";
import { Generator, getConfig } from "@tanstack/router-generator";

const root = process.cwd();
const config = getConfig(
  {
    target: "react",
    routesDirectory: "./src/routes",
    generatedRouteTree: "./src/routeTree.gen.ts",
    disableLogging: true,
  },
  root,
);

const generator = new Generator({ config, root });
await generator.run();
