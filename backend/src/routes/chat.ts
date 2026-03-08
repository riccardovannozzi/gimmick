import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import OpenAI from 'openai';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { chat } from '../services/ai.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const chatRouter = Router();

// All routes require authentication
chatRouter.use(authenticate);

// Multer for voice uploads (memory, max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// OpenAI client for Whisper transcription
const openai = new OpenAI();

// Validation schema
const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(50)
    .default([]),
  model: z.string().optional(),
});

// POST /api/chat — text chat
chatRouter.post(
  '/',
  validate(chatSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { message, history, model } = req.body;

      const result = await chat(message, history, req.user!.id, model);

      res.json({
        success: true,
        data: { reply: result.reply, foundSparkIds: result.foundSparkIds, foundTileIds: result.foundTileIds },
      });
    } catch (error: any) {
      console.error('Chat error:', error);

      if (error?.status === 401) {
        res.status(500).json({
          success: false,
          error: 'AI service authentication failed. Check API key configuration.',
        });
        return;
      }

      if (error?.status === 429) {
        res.status(429).json({
          success: false,
          error: 'AI rate limit reached. Please try again in a moment.',
        });
        return;
      }

      const errorMessage = error?.message || error?.error?.message || 'Failed to process chat message';
      console.error('Chat error details:', error?.message, error?.status, error?.error);
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
);

// POST /api/chat/voice — voice message: transcribe + chat
chatRouter.post(
  '/voice',
  upload.single('audio'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, error: 'No audio file provided' });
        return;
      }

      // Parse history and model from form data
      const history = req.body.history ? JSON.parse(req.body.history) : [];
      const model = req.body.model || undefined;

      // Transcribe with Whisper
      const audioFile = new File([file.buffer], file.originalname || 'audio.m4a', {
        type: file.mimetype || 'audio/mp4',
      });

      const transcription = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: audioFile,
        language: 'it',
      });

      const transcript = transcription.text;

      if (!transcript || transcript.trim().length === 0) {
        res.json({
          success: true,
          data: { transcript: '', reply: 'Non ho capito nulla. Puoi ripetere?' },
        });
        return;
      }

      // Send transcription to Claude
      const result = await chat(transcript, history, req.user!.id, model);

      res.json({
        success: true,
        data: { transcript, reply: result.reply, foundSparkIds: result.foundSparkIds, foundTileIds: result.foundTileIds },
      });
    } catch (error: any) {
      console.error('Voice chat error:', error);
      const errorMessage = error?.message || 'Failed to process voice message';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
);

// POST /api/chat/tts — text-to-speech using OpenAI TTS
chatRouter.post(
  '/tts',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        res.status(400).json({ success: false, error: 'Text is required' });
        return;
      }

      // Strip markdown for cleaner speech
      const cleanText = text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .replace(/`[^`]+`/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .slice(0, 4000);

      const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: cleanText,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await response.arrayBuffer());

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      });
      res.send(buffer);
    } catch (error: any) {
      console.error('TTS error:', error);
      res.status(500).json({ success: false, error: 'TTS failed' });
    }
  }
);
