import { Router, Response } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { BadRequestError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const uploadRouter = Router();

// All routes require authentication
uploadRouter.use(authenticate);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

const BUCKET_NAME = 'memos';

/**
 * Generate unique filename
 */
function generateFileName(originalName: string): string {
  const ext = originalName.split('.').pop() || 'bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `${timestamp}_${random}.${ext}`;
}

/**
 * POST /api/upload/file
 * Upload a single file
 */
uploadRouter.post(
  '/file',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const file = req.file;
      const folder = (req.body.folder as string) || 'files';

      if (!file) {
        throw new BadRequestError('No file provided');
      }

      const fileName = generateFileName(file.originalname);
      const storagePath = `${req.user!.id}/${folder}/${fileName}`;

      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

      res.status(201).json({
        success: true,
        data: {
          path: data.path,
          url: urlData.publicUrl,
          file_name: file.originalname,
          mime_type: file.mimetype,
          file_size: file.size,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/upload/files
 * Upload multiple files
 */
uploadRouter.post(
  '/files',
  upload.array('files', 10), // Max 10 files
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const files = req.files as Express.Multer.File[];
      const folder = (req.body.folder as string) || 'files';

      if (!files || files.length === 0) {
        throw new BadRequestError('No files provided');
      }

      const uploadResults = await Promise.all(
        files.map(async (file) => {
          const fileName = generateFileName(file.originalname);
          const storagePath = `${req.user!.id}/${folder}/${fileName}`;

          const { data, error } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(storagePath, file.buffer, {
              contentType: file.mimetype,
              upsert: false,
            });

          if (error) {
            return {
              success: false,
              file_name: file.originalname,
              error: error.message,
            };
          }

          const { data: urlData } = supabaseAdmin.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path);

          return {
            success: true,
            path: data.path,
            url: urlData.publicUrl,
            file_name: file.originalname,
            mime_type: file.mimetype,
            file_size: file.size,
          };
        })
      );

      const successful = uploadResults.filter((r) => r.success);
      const failed = uploadResults.filter((r) => !r.success);

      res.status(201).json({
        success: true,
        data: {
          uploaded: successful,
          failed: failed,
          summary: {
            total: files.length,
            successful: successful.length,
            failed: failed.length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/upload/file
 * Delete a file from storage
 */
uploadRouter.delete('/file', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { path } = req.body;

    if (!path) {
      throw new BadRequestError('File path is required');
    }

    // Verify path belongs to user
    if (!path.startsWith(`${req.user!.id}/`)) {
      throw new BadRequestError('Invalid file path');
    }

    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/upload/signed-url
 * Get a signed URL for private file access
 */
uploadRouter.get('/signed-url', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const path = req.query.path as string;

    if (!path) {
      throw new BadRequestError('File path is required');
    }

    // Verify path belongs to user
    if (!path.startsWith(`${req.user!.id}/`)) {
      throw new BadRequestError('Invalid file path');
    }

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 3600); // 1 hour

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        url: data.signedUrl,
        expires_in: 3600,
      },
    });
  } catch (error) {
    next(error);
  }
});
