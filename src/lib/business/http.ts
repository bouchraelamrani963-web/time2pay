import "server-only";
import { NextResponse } from "next/server";
import { getBusinessSession } from "../auth";
import { BusinessError, businessEnabled, missing, withCompany, type BusinessActor } from "./access";
import { changeClient, changeDraft, changeFinalInvoice, changeSettings, companyDashboard, companyInvoicePdf } from "./administration";
import { businessAction } from "./contracts";
import { notifyInvite } from "./delivery";
import { acceptInvite, createCompany, listCompanies, manageTeam } from "./team";

const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "private, no-store" },
});

async function handle(run: (actor: BusinessActor) => Promise<Response>) {
  try {
    if (!businessEnabled()) throw missing();
    const session = await getBusinessSession();
    if (!session?.verifiedEmail) throw new BusinessError(401, "Meld je aan met je geverifieerde e-mailadres en authenticator.");
    return await run({ uid: session.uid, verifiedEmail: session.verifiedEmail, authTime: session.authTime });
  } catch (error) {
    if (error instanceof BusinessError) return json({ error: error.message }, error.status);
    console.error("Business request failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "De Business-handeling is mislukt." }, 500);
  }
}

export function readBusiness(path: string[], request?: Request) {
  return handle(async actor => {
    if (!path.length) return json(await listCompanies(actor));
    const [companyId, resource, invoiceId] = path;
    if (path.length === 1) {
      const page = request ? Number(new URL(request.url).searchParams.get("page") ?? "1") : 1;
      if (!Number.isSafeInteger(page) || page < 1) throw new BusinessError(422, "Ongeldig paginanummer.");
      return json(await withCompany(companyId, actor, context => companyDashboard(context, page)));
    }
    if (path.length !== 3 || resource !== "pdf" || !invoiceId) throw missing();
    // A PDF download is an explicit, same-origin, read-only action.
    if (request?.headers.get("sec-fetch-site") === "cross-site") throw missing();
    const { pdf, filename } = await withCompany(companyId, actor, context => companyInvoicePdf(context, invoiceId));
    return new NextResponse(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf", "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
    } });
  });
}

export function writeBusiness(path: string[], request: Request) {
  return handle(async actor => {
    if (path.length > 1) throw missing();
    if (request.headers.get("origin") !== new URL(request.url).origin ||
        request.headers.get("content-type")?.split(";")[0] !== "application/json") {
      throw new BusinessError(403, "Deze aanvraag moet vanuit Time2Pay worden verstuurd.");
    }
    const text = await request.text();
    if (Buffer.byteLength(text) > 300000) throw new BusinessError(413, "De aanvraag is te groot.");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new BusinessError(400, "Ongeldige aanvraag."); }
    const parsed = businessAction.safeParse(body);
    if (!parsed.success) throw new BusinessError(422, parsed.error.issues[0]?.message ?? "Controleer de ingevoerde gegevens.");
    const input = parsed.data;
    const companyId = path[0];

    if (input.action === "createCompany") {
      if (companyId) throw missing();
      return json(await createCompany(actor, input.name), 201);
    }
    if (!companyId) throw missing();
    if (input.action === "accept") return json(await acceptInvite(actor, companyId, input.seatId));

    const result = await withCompany(companyId, actor, async context => {
      if (!context.active && input.action !== "removeSeat") {
        throw new BusinessError(402, "Deze Business-omgeving is alleen-lezen totdat het abonnement weer actief is.");
      }
      switch (input.action) {
        case "invite": case "resendInvite": case "removeSeat": case "changeRole":
          return manageTeam(context, input);
        case "settings": return changeSettings(context, input);
        case "client": case "deleteClient": return changeClient(context, input);
        case "draft": case "deleteDraft": return changeDraft(context, input);
        case "finalize": case "send": case "remind": case "cancel": case "payment":
          return changeFinalInvoice(context, input);
      }
    });
    if (result && "invitation" in result && result.invitation) {
      return json({ emailSent: await notifyInvite(result.invitation) });
    }
    return json(result ?? { ok: true });
  });
}
