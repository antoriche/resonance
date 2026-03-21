/**
 * Authentication middleware placeholder.
 *
 * Currently a no-op that always succeeds.
 * When auth is needed, add token / API-key validation here —
 * no other file needs to change.
 */
export async function authenticate(
  _request: Request,
): Promise<{ authenticated: true }> {
  // TODO: validate Authorization header / API key here
  // Example:
  //   const token = request.headers.get("authorization")?.replace("Bearer ", "");
  //   if (!token || !(await verifyToken(token))) {
  //     throw new Response("Unauthorized", { status: 401 });
  //   }
  return { authenticated: true };
}
