import { readBusiness, writeBusiness } from "@/lib/business/http";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: Request, { params }: RouteContext) {
  return readBusiness((await params).path ?? [], request);
}

export async function POST(request: Request, { params }: RouteContext) {
  return writeBusiness((await params).path ?? [], request);
}
