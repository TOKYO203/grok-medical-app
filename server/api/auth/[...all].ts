import { defineEventHandler } from "h3";
import { auth } from "@/lib/auth/server";

/**
 * Expose Better Auth's complete HTTP surface under `/api/auth/*` in Nitro.
 * The client calls endpoints such as `/api/auth/get-session`; without this
 * catch-all route a production/preview build returns 404 even though the
 * Better Auth server instance itself is configured correctly.
 */
export default defineEventHandler(async (event) => auth.handler(event.req));
