import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isSupportAgent, listTickets } from "@/lib/helpdesk/service";
import HelpdeskWorkspace from "@/components/helpdesk/HelpdeskWorkspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Helpdesk – Beheer | Time2Pay", robots: { index: false, follow: false } };
export default async function SupportPage() {
  const user = await requireUser();
  if (!await isSupportAgent(user.uid)) notFound();
  return <HelpdeskWorkspace initial={await listTickets(user, true, {})} staff />;
}
