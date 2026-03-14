'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Video, Images, PenSquare, Mic, Paperclip, X, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { sparksApi, uploadApi } from '@/lib/api';
import type { SparkType } from '@/types';

const captureColors = {
  photo: '#5B8DEF',
  video: '#E87DA0',
  gallery: '#AB9FF2',
  text: '#6FCF97',
  voice: '#EF4444',
  file: '#F2C94C',
} as const;

const captureColorsBg = {
  photo: '#1A2540',
  video: '#2D1A22',
  gallery: '#241E35',
  text: '#1A2D1E',
  voice: '#2D1A1A',
  file: '#2D2A1A',
} as const;

const captureOptions = [
  { id: 'photo', label: 'PHOTO', icon: Camera, color: captureColors.photo, bg: captureColorsBg.photo, accept: 'image/*', sparkType: 'photo' as const },
  { id: 'video', label: 'VIDEO', icon: Video, color: captureColors.video, bg: captureColorsBg.video, accept: 'video/*', sparkType: 'video' as const },
  { id: 'gallery', label: 'GALLERY', icon: Images, color: captureColors.gallery, bg: captureColorsBg.gallery, accept: 'image/*', sparkType: 'image' as const },
  { id: 'text', label: 'TEXT', icon: PenSquare, color: captureColors.text, bg: captureColorsBg.text, accept: null, sparkType: 'text' as const },
  { id: 'voice', label: 'VOICE', icon: Mic, color: captureColors.voice, bg: captureColorsBg.voice, accept: 'audio/*', sparkType: 'audio_recording' as const },
  { id: 'file', label: 'FILE', icon: Paperclip, color: captureColors.file, bg: captureColorsBg.file, accept: '*/*', sparkType: 'file' as const },
] as const;

interface PendingFile {
  file: File;
  preview?: string;
  sparkType: string;
  captureId: string;
}

export default function CapturePage() {
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [textContent, setTextContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const createSparkMutation = useMutation({
    mutationFn: sparksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sparks'] });
      queryClient.invalidateQueries({ queryKey: ['sparks-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
    },
  });

  const handleButtonClick = (optionId: string) => {
    const option = captureOptions.find((o) => o.id === optionId)!;

    if (option.id === 'text') {
      setActivePanel(activePanel === 'text' ? null : 'text');
      return;
    }

    // For file-based captures, trigger file input
    if (fileInputRef.current) {
      fileInputRef.current.accept = option.accept || '*/*';
      fileInputRef.current.dataset.captureId = option.id;
      fileInputRef.current.dataset.sparkType = option.sparkType;
      fileInputRef.current.multiple = true;
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const captureId = e.target.dataset.captureId || 'file';
    const sparkType = e.target.dataset.sparkType || 'file';

    const newFiles: PendingFile[] = Array.from(files).map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      sparkType,
      captureId,
    }));

    setPendingFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => {
      const file = prev[index];
      if (file.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleTextSubmit = async () => {
    if (!textContent.trim()) return;
    await createSparkMutation.mutateAsync({
      type: 'text',
      content: textContent.trim(),
    });
    toast.success('Spark di testo creato!');
    setTextContent('');
    setActivePanel(null);
  };

  const handleFilesUpload = async () => {
    if (pendingFiles.length === 0) return;
    setIsUploading(true);
    try {
      for (const pending of pendingFiles) {
        const uploadResult = await uploadApi.uploadFile(pending.file);
        if (uploadResult.data) {
          await sparksApi.create({
            type: pending.sparkType as SparkType,
            storage_path: uploadResult.data.path,
            file_name: pending.file.name,
            mime_type: pending.file.type,
            file_size: pending.file.size,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['sparks'] });
      queryClient.invalidateQueries({ queryKey: ['sparks-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
      toast.success(`${pendingFiles.length} file caricati!`);
      pendingFiles.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
      setPendingFiles([]);
    } catch {
      toast.error('Errore durante il caricamento');
    } finally {
      setIsUploading(false);
    }
  };

  const getCountForType = (captureId: string) => {
    return pendingFiles.filter((f) => f.captureId === captureId).length;
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Cattura" />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Capture buttons row */}
        <div className="flex gap-2">
          {captureOptions.map((option) => {
            const Icon = option.icon;
            const count = option.id === 'text' ? 0 : getCountForType(option.id);
            return (
              <button
                key={option.id}
                onClick={() => handleButtonClick(option.id)}
                disabled={isUploading}
                className="relative rounded-xl flex flex-col items-center justify-center transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50 shrink-0"
                style={{ backgroundColor: option.bg, width: 120, height: 120 }}
              >
                <Icon
                  size={24}
                  color={option.color}
                  strokeWidth={1.6}
                />
                <span
                  className="text-[10px] font-semibold mt-2 tracking-wide"
                  style={{ color: '#FFFFFF' }}
                >
                  {option.label}
                </span>
                {count > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-4 h-4 rounded-full flex items-center justify-center px-0.5 text-[9px] font-bold text-white"
                    style={{ backgroundColor: option.color }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Text Panel */}
        {activePanel === 'text' && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-4">
            <Textarea
              placeholder="Scrivi qui il tuo spark..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="min-h-[160px] bg-zinc-800 border-zinc-700 text-white resize-none"
              autoFocus
            />
            <div className="flex justify-between items-center">
              <p className="text-sm text-zinc-400">{textContent.length} caratteri</p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setActivePanel(null); setTextContent(''); }}
                  className="text-zinc-400"
                >
                  Annulla
                </Button>
                <Button
                  size="sm"
                  onClick={handleTextSubmit}
                  disabled={!textContent.trim() || createSparkMutation.isPending}
                  className="bg-[#6FCF97] hover:bg-[#5CB882] text-black"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {createSparkMutation.isPending ? 'Salvando...' : 'Salva'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Pending Files */}
        {pendingFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-zinc-300">
                Buffer ({pendingFiles.length})
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  pendingFiles.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
                  setPendingFiles([]);
                }}
                className="text-zinc-400 hover:text-red-400"
              >
                Rimuovi tutti
              </Button>
            </div>

            <div className="space-y-2">
              {pendingFiles.map((pending, index) => {
                const option = captureOptions.find((o) => o.id === pending.captureId);
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: option?.bg || '#1C1C1E' }}
                  >
                    {pending.preview ? (
                      <img
                        src={pending.preview}
                        alt={pending.file.name}
                        className="h-12 w-12 object-cover rounded-lg"
                      />
                    ) : (
                      <div
                        className="h-12 w-12 flex items-center justify-center rounded-lg"
                        style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                      >
                        {option && <option.icon size={20} color={option.color} strokeWidth={1.4} />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{pending.file.name}</p>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold uppercase"
                          style={{ color: option?.color }}
                        >
                          {option?.label}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {(pending.file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <Button
              onClick={handleFilesUpload}
              disabled={isUploading}
              className="w-full bg-[#AB9FF2] hover:bg-[#9A8DE0] text-black font-semibold"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isUploading
                ? 'Caricamento in corso...'
                : `Carica ${pendingFiles.length} file`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
