import { getTicket, updateTicket } from "@/lib/helpdesk/service";
import { handleHelpdesk, isStaffRequest, readBody, ticketId } from "@/lib/helpdesk/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
  return handleHelpdesk(async user => getTicket(user, isStaffRequest(req), ticketId((await ctx.params).id), new URL(req.url).searchParams.get("before") || undefined));
}
export async function PATCH(req: Request, ctx: Context) {
  return handleHelpdesk(async user => updateTicket(user, ticketId((await ctx.params).id), await readBody(req)));
}
