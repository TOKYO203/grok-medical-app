import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { rateLimitRequest, retryAfterSeconds } from "@/lib/security/rate-limit.server";

/**
 * `POST /api/institution-leads` — capture des demandes de démonstration
 * établissements (B2B-INSTITUTIONNEL-V2.md §4).
 *
 * Ce que ce handler refuse de faire :
 *   • il n'accepte que les champs du formulaire, bornés et validés — un lead
 *     ressemble toujours à une ligne de la table, jamais à un objet libre ;
 *   • il ne renvoie jamais le détail d'une erreur de base de données et ne
 *     journalise pas le contenu du formulaire ;
 *   • il ne déduit ni ne stocke d'identité : la page est publique, le lead ne
 *     porte que ce que le demandeur a saisi lui-même.
 *
 * Réponses :
 *   202 `{ ok: true }`
 *   400 `bad_request`
 *   413 corps trop volumineux
 *   429 `rate_limited`
 *   503 temporairement indisponible
 */

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;

/** Un formulaire complet pèse ~1 Ko ; 8 Ko couvrent un message long. */
const MAX_BODY_BYTES = 8 * 1024;

const STUDENT_RANGES = new Set(["lt50", "50-100", "100-250", "250-500", "gt500"]);

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

/** Chaîne normalisée : trim + plafond, ou chaîne vide si absent. */
function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

type Lead = {
  establishment: string;
  role: string;
  fullName: string;
  email: string;
  phone: string | null;
  studentRange: string | null;
  message: string | null;
};

function readLead(payload: unknown): { lead: Lead } | { error: string } {
  const source = (payload ?? {}) as Record<string, unknown>;
  const establishment = text(source.establishment, 160);
  const role = text(source.role, 120);
  const fullName = text(source.fullName, 120);
  const email = text(source.email, 160).toLowerCase();
  const phone = text(source.phone, 40);
  const studentRange = text(source.studentRange, 20);
  const message = text(source.message, 2000);

  if (!establishment || !role || !fullName || !email) {
    return { error: "Établissement, fonction, nom et e-mail sont requis." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { error: "L'adresse e-mail professionnelle semble invalide." };
  }
  if (phone && !/^[+0-9][0-9 ()+.-]{3,39}$/.test(phone)) {
    return { error: "Le numéro de téléphone semble invalide." };
  }
  if (studentRange && !STUDENT_RANGES.has(studentRange)) {
    return { error: "La tranche d'étudiants est invalide." };
  }
  return {
    lead: {
      establishment,
      role,
      fullName,
      email,
      phone: phone || null,
      studentRange: studentRange || null,
      message: message || null,
    },
  };
}

export const Route = createFileRoute("/api/institution-leads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const decision = await rateLimitRequest(
          request,
          "institution-leads",
          RATE_LIMIT_MAX,
          RATE_LIMIT_WINDOW_MS,
        );
        if (!decision.ok) {
          return json(
            { error: "Trop de demandes envoyées. Réessayez dans quelques minutes." },
            429,
            { "Retry-After": String(retryAfterSeconds(decision)) },
          );
        }

        // Lecture bornée : on refuse AVANT de parser un corps énorme.
        const length = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
          return json({ error: "Formulaire trop volumineux." }, 413);
        }

        let payload: unknown;
        try {
          const bodyText = await request.text();
          if (bodyText.length > MAX_BODY_BYTES) {
            return json({ error: "Formulaire trop volumineux." }, 413);
          }
          payload = bodyText ? JSON.parse(bodyText) : null;
        } catch {
          return json({ error: "Corps JSON invalide." }, 400);
        }

        const parsed = readLead(payload);
        if ("error" in parsed) {
          return json({ error: parsed.error }, 400);
        }

        try {
          const sql = await getSql();
          await sql.query(
            `insert into institution_leads
               (establishment, role, full_name, email, phone, student_range, message)
             values ($1, $2, $3, $4, $5, $6, $7)`,
            [
              parsed.lead.establishment,
              parsed.lead.role,
              parsed.lead.fullName,
              parsed.lead.email,
              parsed.lead.phone,
              parsed.lead.studentRange,
              parsed.lead.message,
            ],
          );
        } catch (error) {
          const code = (error as { code?: string }).code ?? "unknown";
          console.error("institution_leads indisponible", code);
          return json({ error: "Envoi temporairement impossible. Réessayez plus tard." }, 503);
        }

        return json({ ok: true }, 202);
      },
    },
  },
});
