import type { Request, Response, NextFunction } from 'express';
import { getAuthSession, type AuthSession } from '@chat-template/auth';
import { checkChatAccess } from '@chat-template/core';
import { ChatSDKError } from '@chat-template/core/errors';

// Extend Express Request type to include session and user OAuth token
declare global {
  namespace Express {
    interface Request {
      session?: AuthSession;
      userOktaToken?: string;  // User's Okta OAuth token from Databricks
    }
  }
}

/**
 * Middleware to authenticate requests and attach session to request object
 * Also captures user's Okta OAuth token for forwarding to backend agent
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const session = await getAuthSession({
      getRequestHeader: (name: string) =>
        req.headers[name.toLowerCase()] as string | null,
    });
    req.session = session || undefined;

    // Capture user's Okta OAuth token from Databricks forwarded header
    // This token will be passed to the backend agent for Glean API authentication
    const userToken = req.headers['x-forwarded-access-token'] as string;
    if (userToken) {
      req.userOktaToken = userToken;
      console.log(`[Auth] User token captured (length: ${userToken.length})`);
    } else {
      console.warn('[Auth] No x-forwarded-access-token found in request');
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    next(error);
  }
}

/**
 * Middleware to require authentication - returns 401 if no session
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    const response = new ChatSDKError('unauthorized:chat').toResponse();
    return res.status(response.status).json(response.json);
  }
  next();
}

export async function requireChatAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { id } = req.params;
  if (!id) {
    console.error(
      'Chat access middleware error: no chat ID provided',
      req.params,
    );
    const error = new ChatSDKError('bad_request:api');
    const response = error.toResponse();
    return res.status(response.status).json(response.json);
  }
  const { allowed, reason } = await checkChatAccess(id, req.session?.user.id);
  if (!allowed) {
    console.error(
      'Chat access middleware error: user does not have access to chat',
      reason,
    );
    const error = new ChatSDKError('forbidden:chat', reason);
    const response = error.toResponse();
    return res.status(response.status).json(response.json);
  }
  next();
}
