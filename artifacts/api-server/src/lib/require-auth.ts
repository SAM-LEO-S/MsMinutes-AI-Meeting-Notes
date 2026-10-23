import type { RequestHandler } from "express";

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

export const requireAuth: RequestHandler = async (_req, res, next) => {
  if (!supabaseUrl || !supabasePublishableKey) {
    res.status(503).json({ error: "Authentication is not configured on this server." });
    return;
  }

  const authorization = _req.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Sign in to access your meetings." });
    return;
  }

  try {
    // Ask Supabase Auth to validate the access token. This avoids trusting
    // unverified JWT claims or relying on a locally configured JWT secret.
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${match[1]}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      res.status(401).json({ error: "Your session is invalid or has expired. Sign in again." });
      return;
    }

    const user = (await response.json()) as { id?: unknown };
    if (typeof user.id !== "string" || !user.id) {
      res.status(401).json({ error: "Your session could not be verified. Sign in again." });
      return;
    }
    res.locals.userId = user.id;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    _req.log.error({ message }, "Supabase token validation failed");
    res.status(503).json({ error: "Could not verify your session. Please try again." });
  }
};
