import { notFound, redirect } from "next/navigation";
import BusinessWorkspace from "@/components/business/BusinessWorkspace";
import { getBusinessSession } from "@/lib/auth";
import { businessEnabled } from "@/lib/business/access";

export const metadata = { title: "Business | Time2Pay" };

export default async function BusinessPage() {
  if (!businessEnabled()) notFound();
  if (!(await getBusinessSession())?.verifiedEmail) redirect("/login?next=/business");
  return <BusinessWorkspace />;
}
