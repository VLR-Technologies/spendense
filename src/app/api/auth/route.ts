import { serverClient } from "@/lib/supabase/server";
import { financialOperationsEnabled } from "@/lib/deployment";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  if (!financialOperationsEnabled())
    return Response.json(
      { user: null, configured: false, maintenance: true },
      { status: 503, headers: { ...headers, "Retry-After": "3600" } },
    );
  const client = await serverClient();
  if (!client)
    return Response.json({ user: null, configured: false }, { headers });
  let result;
  try {
    result = await client.auth.getUser();
  } catch {
    return Response.json({ user: null }, { status: 503, headers });
  }
  const { data, error } = result;
  if (error)
    return Response.json(
      { user: null },
      {
        status:
          error.status === 400 || error.status === 401 || error.status === 403
            ? 401
            : 503,
        headers,
      },
    );
  return Response.json(
    { user: data.user ? { id: data.user.id, email: data.user.email } : null },
    { headers },
  );
}
