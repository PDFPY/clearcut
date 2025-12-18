import { NextResponse } from "next/server";
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) return new NextResponse("Missing file", { status: 400 });

  const apiBase = process.env.BG_API_URL || "http://localhost:8000";
  const out = await fetch(`${apiBase}/remove_png`, { method: "POST", body: form });
  if (!out.ok) return new NextResponse(await out.text().catch(()=>"Error"), { status: 500 });

  const buf = await out.arrayBuffer();
  return new NextResponse(buf, { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}
