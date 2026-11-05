import { createTicket, listTickets } from "@/lib/helpdesk/service";
import { handleHelpdesk, isStaffRequest, readBody } from "@/lib/helpdesk/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return handleHelpdesk(user => listTickets(user, isStaffRequest(req), Object.fromEntries(new URL(req.url).searchParams.entries())));
}
export async function POST(req: Request) {
  return handleHelpdesk(async user => createTicket(user, await readBody(req)), 201);
}
