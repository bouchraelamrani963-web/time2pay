import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUserOrUnauthorized } from "@/lib/auth";
import { HelpdeskError } from "./policy";
export function helpdeskJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}
export async function readBody(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) throw new HelpdeskError(403, "Ongeldige herkomst.");
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new HelpdeskError(415, "Gebruik JSON.");
  const reader = req.body?.getReader();
  if (!reader) throw new HelpdeskError(400, "Leeg verzoek.");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 40000) { await reader.cancel(); throw new HelpdeskError(413, "Je bericht is te lang."); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new HelpdeskError(400, "Ongeldige JSON."); }
}
export async function handleHelpdesk(action: (user: Exclude<Awaited<ReturnType<typeof requireUserOrUnauthorized>>, Response>) => Promise<unknown>, status = 200) {
  try {
    const user = await requireUserOrUnauthorized();
    if (user instanceof Response) return helpdeskJson({ error: "Log opnieuw in om je aanvragen te bekijken." }, 401);
    return helpdeskJson(await action(user), status);
  } catch (error) {
    if (error instanceof HelpdeskError) return helpdeskJson({ error: error.message }, error.status);
    if (error instanceof ZodError) return helpdeskJson({ error: error.issues.some(i => i.message.includes("Verwijder")) ? "Verwijder wachtwoorden, authenticatorcodes en herstelcodes uit je bericht." : "Controleer de ingevulde velden en de maximale lengte." }, 422);
    // Do not log Prisma errors or request bodies: these may contain ticket text/PII.
    return helpdeskJson({ error: "De helpdesk is tijdelijk niet beschikbaar. Probeer het later opnieuw." }, 503);
  }
}
export function isStaffRequest(req: Request) { return new URL(req.url).searchParams.get("view") === "support"; }
export function ticketId(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new HelpdeskError(404, "Aanvraag niet gevonden.");
  return id;
}
