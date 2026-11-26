import { defineEventHandler } from "h3";
import { getAuth } from "@/lib/auth/server";

/**
 * Expose Better Auth’s complete HTTP surface under `/api/auth/*` in Nitro.
 * TEMP #534 : branche de diagnostic `/api/auth/dbshape` (format masqué du
 * secret DATABASE_URL, jamais sa valeur) — à retirer après investigation.
 */
export default defineEventHandler(async (event) => {
  const { pathname } = new URL(event.req.url);
  if (pathname === "/api/auth/dbshape") {
    const raw = process.env.DATABASE_URL ?? "";
    const s = typeof raw === "string" ? raw : String(raw ?? "");
    const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.\-]*):(\/\/)?/.exec(s);
    const codes = Array.from(s).map((ch) => ch.codePointAt(0) as number);
    const nonAscii = codes.filter((c) => c > 126);
    const at = [...s].map((ch, i) => (ch === "@" ? i : -1)).filter((i) => i >= 0);
    const afterAt = at.length ? s.slice(at[at.length - 1] + 1) : null;
    const hostPart = afterAt ? afterAt.split(/[/?]/)[0] : null;
    const urlOk = (() => { try { new URL(s); return true; } catch { return false; } })();
    const stripped = s.replace(/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//, "");
    const withScheme = (() => { try { new URL("postgresql://" + stripped); return true; } catch { return false; } })();
    return {
      probe: "dbshape-v2",
      sourceType: typeof process.env.DATABASE_URL,
      lenRaw: raw.length,
      lenTrim: s.trim().length,
      sameTrimmed: s === s.trim(),
      scheme: schemeMatch ? schemeMatch[1] : null,
      hasSchemeSlashes: Boolean(schemeMatch?.[2]),
      startsWithPg: /^(postgres(ql)?:\/\/)/i.test(s),
      atCount: at.length,
      slashCount: (s.match(/\//g) || []).length,
      colonCount: (s.match(/:/g) || []).length,
      hasWhitespace: /\s/.test(s),
      emptyAfterAt: at.length ? afterAt!.length === 0 : null,
      hostGuess: hostPart ? {
        len: hostPart.length,
        hasDot: hostPart.includes("."),
        firstLabelMasked: hostPart.replace(/^[^.]+/, "***"),
      } : null,
      firstCharCode: codes[0] ?? null,
      lastCharCode: codes[codes.length - 1] ?? null,
      nonAsciiCount: nonAscii.length,
      nonAsciiFirstCodes: nonAscii.slice(0, 3),
      newUrlOk,
      withSchemeParses: withScheme,
    };
  }
  return getAuth().handler(event.req);
});
