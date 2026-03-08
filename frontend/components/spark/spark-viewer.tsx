'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, File, Download, Loader2, AlertCircle } from 'lucide-react';
import { uploadApi } from '@/lib/api';
import { typeColors, typeLabels, formatDuration, formatFileSize } from '@/lib/spark-utils';
import { cn } from '@/lib/utils';
import type { Spark } from '@/types';

interface SparkViewerProps {
  spark: Spark | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SparkViewer({ spark, open, onOpenChange }: SparkViewerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !spark) {
      setSignedUrl(null);
      setError(null);
      return;
    }

    if (spark.type === 'text') return;

    if (!spark.storage_path) {
      setError('Percorso file mancante');
      return;
    }

    setLoading(true);
    setError(null);

    uploadApi
      .getSignedUrl(spark.storage_path)
      .then((result) => {
        if (result.success && result.data) {
          setSignedUrl(result.data.url);
        } else {
          setError(result.error || 'Impossibile ottenere il link al file');
        }
      })
      .catch(() => {
        setError('Errore di rete');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, spark]);

  function renderContent() {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin mb-3" />
          <p>Caricamento...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-red-400">
          <AlertCircle className="h-8 w-8 mb-3" />
          <p>{error}</p>
        </div>
      );
    }

    if (!spark) return null;

    switch (spark.type) {
      case 'photo':
      case 'image':
        return (
          <div className="flex items-center justify-center">
            <img
              src={signedUrl!}
              alt={spark.file_name || 'Immagine'}
              className="max-h-[70vh] max-w-full rounded-lg object-contain"
            />
          </div>
        );

      case 'video':
        return (
          <video
            src={signedUrl!}
            controls
            className="max-h-[70vh] w-full rounded-lg"
          >
            Il tuo browser non supporta il tag video.
          </video>
        );

      case 'audio_recording':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <Mic className="h-16 w-16 text-zinc-500" />
            <audio src={signedUrl!} controls className="w-full" />
            {spark.duration != null && (
              <p className="text-sm text-zinc-400">
                Durata: {formatDuration(spark.duration)}
              </p>
            )}
          </div>
        );

      case 'text':
        return (
          <ScrollArea className="max-h-[60vh]">
            <div className="whitespace-pre-wrap text-zinc-200 text-sm leading-relaxed p-4 rounded-lg bg-zinc-800/50">
              {spark.content || 'Nessun contenuto'}
            </div>
          </ScrollArea>
        );

      case 'file':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <File className="h-16 w-16 text-zinc-500" />
            <div className="text-center space-y-1">
              <p className="text-white font-medium">{spark.file_name || 'File'}</p>
              {spark.mime_type && (
                <p className="text-sm text-zinc-400">{spark.mime_type}</p>
              )}
              {spark.file_size != null && (
                <p className="text-sm text-zinc-400">{formatFileSize(spark.file_size)}</p>
              )}
            </div>
            {signedUrl && (
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <a href={signedUrl} download={spark.file_name} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Scarica
                </a>
              </Button>
            )}
          </div>
        );

      default:
        return <p className="text-zinc-400 text-center py-8">Tipo non supportato</p>;
    }
  }

  const isMediaType = spark && ['photo', 'image', 'video'].includes(spark.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'bg-zinc-900 border-zinc-800',
          isMediaType ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-white truncate">
            {spark?.file_name || spark?.content?.substring(0, 40) || typeLabels[spark?.type || 'file']}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2">
              {spark && (
                <Badge className={typeColors[spark.type]}>
                  {typeLabels[spark.type]}
                </Badge>
              )}
              <span className="text-zinc-500 text-sm">
                {spark
                  ? new Date(spark.created_at).toLocaleDateString('it-IT', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
