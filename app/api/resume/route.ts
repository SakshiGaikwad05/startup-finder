// POST multipart/form-data { file: resume.pdf } → suggested skills/roles/locations.
// The PDF is read in memory and discarded; nothing about the file is stored.
import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { parseResumeText } from "@/lib/resume/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Upload a PDF file." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "PDF is larger than 5 MB." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
    return NextResponse.json({ error: "That doesn't look like a PDF. Please upload your resume as a PDF." }, { status: 400 });
  }
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const t = Array.isArray(text) ? text.join("\n") : text;
    if (t.trim().length < 50) {
      return NextResponse.json(
        { error: "Couldn't read text from this PDF (it may be a scanned image). Add your skills manually instead." },
        { status: 422 }
      );
    }
    return NextResponse.json(parseResumeText(t));
  } catch {
    return NextResponse.json({ error: "Couldn't read this PDF. Add your skills manually instead." }, { status: 422 });
  }
}
