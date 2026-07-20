import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rewriteText } from '../services/ai.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const aiRouter = Router();

// Shape of errors thrown by the Anthropic SDK
type ApiError = { status?: number; message?: string; error?: { message?: string } };

// All routes require authentication
aiRouter.use(authenticate);

// Validation schema
const rewriteSchema = z.object({
  text: z.string().min(1).max(8000),
  instruction: z.string().min(1).max(500),
});

// POST /api/ai/rewrite — riscrive un testo (o porzione selezionata) con l'AI
aiRouter.post(
  '/rewrite',
  validate(rewriteSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { text, instruction } = req.body;
      const result = await rewriteText(text, instruction);
      res.json({ success: true, data: { result } });
    } catch (error) {
      const err = error as ApiError;
      console.error('AI rewrite error:', err.message, err.status);

      if (err.status === 401) {
        res.status(500).json({
          success: false,
          error: 'AI service authentication failed. Check API key configuration.',
        });
        return;
      }
      if (err.status === 429) {
        res.status(429).json({
          success: false,
          error: 'AI rate limit reached. Please try again in a moment.',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: err.message || err.error?.message || 'Failed to rewrite text',
      });
    }
  }
);
