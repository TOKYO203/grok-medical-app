import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

// Phase 4 (UX « navigation classée ») : la navigation vit dans une source
// unique rangée par groupes. Ce garde-fou verrouille la systématisation :
// une seule taxonomie, des cibles réelles, des libellés traduits, et tous
// les points d'entrée (shell, tiroir mobile, palette) branchés dessus.
const navigation = readFileSync(new URL("../src/lib/navigation.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/components/shell.tsx", import.meta.url), "utf8");
const drawer = readFileSync(
  new URL("../src/components/mobile-tools-drawer.tsx", import.meta.url),
  "utf8",
);
const palette = readFileSync(new URL("../src/components/command-palette.tsx", import.meta.url), "utf8");
const frCatalog = readFileSync(new URL("../src/i18n/messages/fr.ts", import.meta.url), "utf8");
const enCatalog = readFileSync(new URL("../src/i18n/messages/en.ts", import.meta.url), "utf8");

test("la navigation vit dans une source unique consommée par tous les points d'entrée", () => {
  for (const entry of [
    ["shell", shell],
    ["tiroir mobile", drawer],
    ["palette", palette],
  ]) {
    assert.match(
      entry[1],
      /from "@\/lib\/navigation"/,
      entry[0] + " doit importer la configuration centrale",
    );
  }
  assert.doesNotMatch(shell, /const NAV = \[/, "le shell ne doit plus redéfinir NAV localement");
  assert.doesNotMatch(shell, /const EXPLORE = \[/, "le shell ne doit plus redéfinir EXPLORE localement");
});

test("chaque cible configurée correspond à une route réellement déclarée", () => {
  const targets = [...navigation.matchAll(/to: "(\/[^"]*)"/gi)].map((m) => m[1]);
  assert.ok(targets.length >= 15, "la configuration de navigation semble vide");
  for (const target of new Set(targets)) {
    const file = target === "/" ? "index" : target.slice(1);
    assert.ok(
      existsSync(new URL("../src/routes/" + file + ".tsx", import.meta.url)),
      "la cible " + target + " n'a pas de route src/routes/" + file + "+ݜވ˂Ȉ
NBߊNݙ\݊ۉٞܘ][ۈ\݈؛ٰꙈ[Ȝ]X]وܛݜ\Șۘ\ܰꙜș]ۛȝڙ\ȋ

HOȞۛܝܛݜȏHˋ˛؝ڙ؝[ۋۘ]ڐ[
ۘXٛٞNȈʛ؝׋ٜ۝\֗ȗJʈ˙ʗKۘ\

JHOțV̗JN\ܙ\݋ٙY\\]X[
ܛݜˈۘ]˙ܛݜۙX\ۈ˂Ȉۘ]˙ܛݜݜؚ[ȋȈۘ]˙ܛݜݛۛȋȈۘ]˙ܛݜ؛ۛ][ڝH˂ȈJNۛܝ][\ȏHˋ˛؝ڙ؝[ۋۘ]ڐ[
מȝΈʗ֗ȗJʈˈXٛٞNȈ֗ȗJȋXۛΈʈKيWN\ܙ\݋ۚʚ][\˛[ٝψLۙ\șܛݜ\șH	ٞܘ]]\ȜٛXۙ[݈ڙ\ȊNJNݙ\݊ؚ\]YHXٛ0ꈙH؝ڙ؝[ۈ^\ݙH[܈\ș]^؝[ٝY\ȋ

HOȞۛܝٞ\ȏHˋ˛؝ڙ؝[ۋۘ]ڐ[
ʏΛXٛٞ_ڛܝٞJNȈʖ׈׊ʈ˙ڊWKۘ\

JHOțV̗JN\ܙ\݋ۚʚٞ\˛[ٝψMK؝XݛțXٛ0ꈙH؝ڙ؝[ۈ0ꝙXݰꈊNۜȊۛܝٞHوٝȔٝ
ٞ\ʊH\ܙ\݋ۚʙܐ؝[ًڛ؛Y\ʉȉȊȚٞH
ȉȎɊK؛0ꈘXܙ[ݙHH؝[ٝYH܈ȈȊȚٞJN\ܙ\݋ۚʙ[И][ًڛ؛Y\ʉȉȊȚٞH
ɈΉʋ؛0ꈘXܙ[ݙHH؝[ٝYH[ȎȈȊȚٞJNBߊNݙ\݊ۙH\ۚ\ț[ؚ[H^ܙHH؝ڙ؝[ۈۘ\ܰꙈۛ\0ꝙH]وٜۙH[ț؝ڙݘ[݈ˈ

HOȞ\ܙ\݋ۘ]ڊ؝ٜˈӐU׋ۘ\ʎ\ܙ\݋ۘ]ڊ؝ٜˈіԑWєӕT׋ۘ\ʎ\ܙ\݋ۘ]ڊ؝ٜˈ؜ژKXݜܙ[ݏWؘݚ]وȈܘYوȎȝ[ٙYڛٙKʎ\ܙ\݋ۘ]ڊ؝ٜˈ؛݈ۜۛܙHH

HOȜٝܙ[׊؛ٗ
Kʎ\ܙ\݋ۘ]ڊ؝ٜˈۛЛXڏW؛ܙWKʎ\ܙ\݋ۘ]ڊ؝ٜˈݗ
ٜ؝ٜ׋ݚ]H׊Kʎ\ܙ\݋ۘ]ڊ؝ٜˈܛۙOHٚX[وˊNJNݙ\݊ۘH[]H\݈ޜݰꛘ]\𪙈Ȝ٘ݚ[ۜȘۘ\ܰꙜș]YٜȚ\ܝY\șHH؝ڙ؝[ۈˈ

HOȞ\ܙ\݋ۘ]ڊ[]KӐUהQєˊN\ܙ\݋ۘ]ڊ[]KіԑWєӕTˊN\ܙ\݋ۘ]ڊ[]KԑPՒSӗӐPѓґVKʎۜȊۛܝٞHوȜ[]KܙXݚ[ۋܘYٜȋܘ[]KܙXݚ[ۋؘ\ٜȋܘ[]KܙXݚ[ۋؘYٜȗJH\ܙ\݋ۚʜ[]Kڛ؛Y\ʉȉȊȚٞH
ȉȉʋܙXݚ[ۈX[ܝX[ݙHȈȊȚٞJNBȈˈ\Ȝݜ٘XٜȜڛؚ\[\șڝ݈ٛ0Ꝝو]ZYۘXۙ\ș\Z\țH[]KȈˈۚ]\٘ݙ[Y[݋ۚ]ژHH^ۛۚYHٛݜ؛H]IٛHۛܛۛYKۜȊۛܝ۝]Hوȋٞ[Y[ȋ˘]\؝[][ۈˈ˘ۘ\ܙ[Y[݈ˈ˚[\ܝˈ˙ۛٙ\ȗJH\ܙ\݋ۚʂȈ[]Kڛ؛Y\ʉȉȊȜ۝]H
ȉȉʈ؝ڙ؝[ۋڛ؛Y\ʉݛΈɈ
Ȝ۝]H
ȉȉʋȈܘYو[ݜ۝]ؘۙH[܈H[]H݈H؝ڙ؝[ۈȈȊȜ۝]KȈ
NBߊN