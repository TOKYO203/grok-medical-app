import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const routesDirectory = new URL("../src/routes/", import.meta.url);
const routeFiles = (await readdir(routesDirectory)).filter((file) => file.endsWith(".tsx"));
const routeSources = await Promise.all(
  routeFiles.map(async (file) => ({
    file,
    source: await readFile(new URL(file, routesDirectory), "utf8"),
  })),
);
const componentsDirectory = new URL("../src/components/", import.meta.url);
const componentFiles = (await readdir(componentsDirectory)).filter((file) => file.endsWith(".tsx"));
const componentSources = await Promise.all(
  componentFiles.map(async (file) => ({
    file: `components/${file}`,
    source: await readFile(new URL(file, componentsDirectory), "utf8"),
  })),
);
const sources = [...routeSources, ...componentSources];

const declaredRoutes = new Set(["/"]);
for (const { source } of routeSources) {
  for (const match of source.matchAll(/createFileRoute\("([^"]+)"\)/g)) {
    declaredRoutes.add(match[1]);
  }
}

test("every literal internal navigation target names a declared route", () => {
  for (const { file, source } of sources) {
    for (const match of source.matchAll(/\bto="([^"]+)"/g)) {
      assert.ok(declaredRoutes.has(match[1]), `${file}: unknown route ${match[1]}`);
    }
  }
});

test("links never contain nested buttons", () => {
  for (const { file, source } of sources) {
    assert.doesNotMatch(
      source,
      /<Link\b(?:(?!<\/Link>)[\s\S])*?<Button\b/,
      `${file}: use one styled Link instead of nested interactive elements`,
    );
  }
});

test("download links point to files shipped in public", async () => {
  for (const { file, source } of sources) {
    for (const match of source.matchAll(/\bhref="(\/[^"?#]+)"/g)) {
      await assert.doesNotReject(
        access(join(new URL("../public/", import.meta.url).pathname, match[1])),
        `${file}: missing public asset ${match[1]}`,
      );
    }
  }
});


test("every Deck curriculum step links to learning or its free preview", () => {
  const deckRoute = routeSources.find(({ file }) => file === "parcours.$deckId.tsx");
  assert.ok(deckRoute, "missing Deck detail route");
  assert.match(
    deckRoute.source,
    /preview:\s*!open,[\s\S]*mode:\s*open\s*\?\s*"lesson"\s*:\s*"preview"/,
    "locked curriculum steps must open the free preview instead of acting like dead cards",
  );
});


test("parent routes render their dynamic child pages", () => {
  for (const file of ["parcours.tsx", "cas.tsx"]) {
    const route = routeSources.find((source) => source.file === file);
    assert.ok(route, `missing parent route ${file}`);
    assert.match(route.source, /return <Outlet \/>/, `${file}: dynamic child routes need an Outlet`);
  }
});


test("diagnostic program keeps all 43 source items ordered and uniquely identified", async () => {
  const topics = JSON.parse(
    await readFile(new URL("../src/content/data/diagnostic-topics.json", import.meta.url), "utf8"),
  );
  const diagnostics = JSON.parse(
    await readFile(new URL("../src/content/data/diagnostics.json", import.meta.url), "utf8"),
  );
  assert.equal(topics.length, 43);
  assert.deepEqual(
    topics.map((topic) => topic.number),
    Array.from({ length: 43 }, (_, index) => index + 1),
  );
  assert.equal(new Set(topics.map((topic) => topic.id)).size, topics.length);
  const diagnosticIds = new Set(diagnostics.map((diagnostic) => diagnostic.id));
  for (const topic of topics.filter((item) => item.routeId)) {
    assert.ok(diagnosticIds.has(topic.routeId), `unknown diagnostic route ${topic.routeId}`);
    assert.equal(topic.status, "available");
  }
});
