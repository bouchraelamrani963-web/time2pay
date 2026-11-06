import { requireUser } from "@/lib/auth";
import { isSupportAgent, listTickets } from "@/lib/helpdesk/service";
import HelpdeskWorkspace from "@/components/helpdesk/HelpdeskWorkspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Kennisbank | Time2Pay", robots: { index: false, follow: false } };
export default async function KnowledgePage() {
  const user = await requireUser();
  const [initial, canManage] = await Promise.all([listTickets(user, false, {}), isSupportAgent(user.uid)]);
  return <HelpdeskWorkspace initial={initial} canManage={canManage} knowledge />;
}
