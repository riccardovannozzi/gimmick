import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin, supabaseAuth } from '../config/supabase.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const authRouter = Router();

// Validation schemas
const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/auth/signup
 * Register a new user
 */
authRouter.post('/signup', validate(signUpSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: process.env.NODE_ENV !== 'production',
    });

    if (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      },
      message: 'User created successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/signin
 * Sign in with email and password
 */
authRouter.post('/signin', validate(signInSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
      return;
    }

    const { data, error } = await supabaseAuth.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/signout
 * Sign out user
 */
authRouter.post(
  '/signout',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      await supabaseAdmin.auth.admin.signOut(req.accessToken!);

      res.json({
        success: true,
        message: 'Signed out successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/auth/me
 * Get current user
 */
authRouter.get(
  '/me',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user!.id,
          email: req.user!.email,
          created_at: req.user!.created_at,
        },
      },
    });
  }
);
