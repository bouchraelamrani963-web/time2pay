import "server-only";
import { getPaidEntitlement } from "./billing";
import { getRegistrationTrial } from "./registration-trial";

export async function getInvoiceEntitlement(userId: string) {
  // Existing paid customers retain their plan's limits and period.
  return await getPaidEntitlement(userId) ?? await getRegistrationTrial(userId);
}
export async function hasInvoiceAccess(userId: string) {
  return !!await getInvoiceEntitlement(userId);
}
