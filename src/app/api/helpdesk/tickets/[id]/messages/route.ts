import { replyToTicket } from "@/lib/helpdesk/service";
import { handleHelpdesk, isStaffRequest, readBody, ticketId } from "@/lib/helpdesk/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleHelpdesk(async user => replyToTicket(user, isStaffRequest(req), ticketId((await ctx.params).id), await readBody(req)), 201);
}
