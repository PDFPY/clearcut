import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE = process.env.BG_API_URL || "http://127.0.0.1:8000";

export async function POST(req: Request) {
  try {
    const inForm = await req.formData();
    const file = inForm.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field 'file'." }, { status: 400 });
    }

    // Build a new form for the FastAPI backend
    const outForm = new FormData();
    outForm.append("file", file, file.name || "upload.png");

    // Optional timeout so it doesn't hang forever
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const res = await fetch(`${API_BASE}/remove_png`, {
      method: "POST",
      body: outForm,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Backend error (${res.status})`, detail: text || null },
        { status: 502 }
      );
    }

    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? "Request timed out calling backend."
        : err?.message || String(err);

    return NextResponse.json({ error: "Remove failed", detail: msg }, { status: 500 });
  }
}
