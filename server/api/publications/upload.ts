import { defineEventHandler, getMethod, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import { applyRateLimitHeaders, consumeRateLimit } from "../../lib/rate-limit";
import { apiAuthFailure, requireContentEditor } from "../../lib/route-auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DEFAULT_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET?.trim() || "public";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Map([
  ["application/pdf", [".pdf"]],
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
]);

const uploadSchema = z
  .object({
    filename: z.string().trim().min(1).max(180),
    contentType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
    contentBase64: z.string().min(1),
  })
  .strict();

function extension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function signatureMatches(buffer: Buffer, contentType: string): boolean {
  if (contentType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (contentType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/webp") {
    return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

export default defineEventHandler(async (event) => {
  if (getMethod(event).toUpperCase() !== "POST") {
    setResponseStatus(event, 405);
    return { error: "Method Not Allowed" };
  }

  let editorId: string;
  try {
    editorId = (await requireContentEditor(event)).id;
  } catch (error) {
    const authError = apiAuthFailure(error);
    if (authError) {
      setResponseStatus(event, authError.statusCode);
      return { error: authError.message };
    }
    throw error;
  }

  try {
    const decision = await consumeRateLimit({
      scope: "publication-upload",
      subject: editorId,
      limit: 20,
      windowSeconds: 60,
    });
    applyRateLimitHeaders(event, decision);
    if (!decision.allowed) {
      setResponseStatus(event, 429);
      return { error: "rate_limited" };
    }
  } catch (error) {
    console.error("[publications] upload rate limiter unavailable", error);
    setResponseStatus(event, 503);
    return { error: "upload_protection_unavailable" };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    setResponseStatus(event, 503);
    return { error: "Storage temporarily unavailable" };
  }

  const parsed = uploadSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return { error: "invalid_upload", issues: parsed.error.flatten() };
  }

  const { filename, contentType, contentBase64 } = parsed.data;
  const allowedExtensions = ALLOWED_TYPES.get(contentType) ?? [];
  if (!allowedExtensions.includes(extension(filename))) {
    setResponseStatus(event, 415);
    return { error: "file_extension_mismatch" };
  }

  // Reject oversized Base64 before allocating the decoded buffer.
  const maxEncodedLength = Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 8;
  if (contentBase64.length > maxEncodedLength) {
    setResponseStatus(event, 413);
    return { error: "file_too_large", maxBytes: MAX_UPLOAD_BYTES };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(contentBase64, "base64");
  } catch {
    setResponseStatus(event, 400);
    return { error: "invalid_base64" };
  }

  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    setResponseStatus(event, buffer.length > MAX_UPLOAD_BYTES ? 413 : 400);
    return { error: buffer.length > MAX_UPLOAD_BYTES ? "file_too_large" : "empty_file" };
  }
  if (!signatureMatches(buffer, contentType)) {
    setResponseStatus(event, 415);
    return { error: "file_signature_mismatch" };
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `publications/${Date.now()}-${safeFilename}`;
  const uploadUrl = `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/${encodeURIComponent(DEFAULT_BUCKET)}/${encodeURIComponent(key)}`;

  try {
    const uploadBody = new Blob([Uint8Array.from(buffer)], { type: contentType });
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "x-upsert": "false",
        "Content-Type": contentType,
      },
      body: uploadBody,
    });

    if (!response.ok) {
      console.error("[publications] storage upload failed", response.status);
      setResponseStatus(event, 502);
      return { error: "upload_failed" };
    }

    const publicUrl = `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/${encodeURIComponent(DEFAULT_BUCKET)}/${encodeURIComponent(key)}`;
    return { bucket: DEFAULT_BUCKET, key, publicUrl, contentType, size: buffer.length };
  } catch (error) {
    console.error("[publications] storage upload error", error);
    setResponseStatus(event, 502);
    return { error: "upload_failed" };
  }
});
