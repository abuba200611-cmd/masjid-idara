import { isAdmin } from "@/lib/admin-auth";

export async function GET() {
  return Response.json({ admin: await isAdmin() });
}
