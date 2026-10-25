import type { NextRequest } from "next/server";
import { getUsersRange } from "@/lib/data";

const MAX_PAGE = 100;
const MAX_TOTAL = 1_000_000;

// GET /api/users?start=0&end=50&total=100000
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const start = Math.max(0, Math.floor(Number(params.get("start")) || 0));
  const end = Math.min(Math.floor(Number(params.get("end")) || 0), start + MAX_PAGE);
  const total = Math.min(Math.floor(Number(params.get("total")) || 0), MAX_TOTAL);
  return Response.json(await getUsersRange(start, end, total));
}
