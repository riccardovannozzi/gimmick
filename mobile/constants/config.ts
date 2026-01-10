/**
 * MOCA App Configuration
 */
export const config = {
  // App info
  app: {
    name: 'MOCA',
    version: '1.0.0',
  },

  // Buffer limits
  buffer: {
    maxItems: 50,
    thumbnailSize: 64,
  },

  // Media settings
  media: {
    photo: {
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1080,
    },
    audio: {
      maxDurationMs: 300000, // 5 minutes
      sampleRate: 44100,
      numberOfChannels: 2,
    },
    file: {
      maxSizeMB: 50,
      allowedTypes: ['*/*'],
    },
  },

  // Upload settings
  upload: {
    chunkSize: 1024 * 1024, // 1MB
    maxRetries: 3,
    retryDelayMs: 1000,
    timeoutMs: 30000,
  },

  // UI settings
  ui: {
    captureButtonHeight: 56,
    bufferBarHeight: 72,
    sendButtonSize: 48,
    thumbnailSize: 56,
    toastDurationMs: 3000,
  },

  // Animation durations
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
} as const;
