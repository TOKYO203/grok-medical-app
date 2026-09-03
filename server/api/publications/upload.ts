import { defineEventHandler, readBody } from "h3";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DEFAULT_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET || "public";

export default defineEventHandler(async (event) => {
  if ((event.node.req.method || "POST").toUpperCase() !== "POST") {
    event.node.res.statusCode = 405;
    return { error: "Method Not Allowed" };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    event.node.res.statusCode = 500;
    return { error: "Supabase storage not configured" };
  }

  const body = (await readBody(event)) as any;
  const filename = String(body.filename || "file.bin");
  const contentBase64 = String(body.contentBase64 || "");
  const bucket = String(body.bucket || DEFAULT_BUCKET);

  if (!contentBase64) {
    event.node.res.statusCode = 400;
    return { error: "contentBase64 is required" };
  }

  const buffer = Buffer.from(contentBase64, "base64");
  const key = `publications/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const uploadUrl = `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`;

  try {
    const resp = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "x-upsert": "false",
        "Content-Type": "application/octet-stream",
      },
      body: buffer,
    });
    if (!resp.ok) {
      const text = await resp.text();
      event.node.res.statusCode = 502;
      return { error: "upload_failed", detail: text };
    }

    // public object URL
    const publicUrl = `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`;
    return { bucket, key, publicUrl };
  } catch (err: any) {
    event.node.res.statusCode = 500;
    return { error: "upload_error", message: err?.message ?? String(err) };
  }
});
