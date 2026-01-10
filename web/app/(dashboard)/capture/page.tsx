'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { FileText, Upload, Mic, X, Send, File, Image, Music } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { memosApi, uploadApi } from '@/lib/api';

interface PendingFile {
  file: File;
  preview?: string;
  type: 'image' | 'audio' | 'file';
}

export default function CapturePage() {
  const [textContent, setTextContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const createMemoMutation = useMutation({
    mutationFn: memosApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] });
      toast.success('Memo creato!');
      setTextContent('');
    },
    onError: () => {
      toast.error('Errore durante la creazione');
    },
  });

  const getFileType = (file: File): 'image' | 'audio' | 'file' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'file';
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: PendingFile[] = acceptedFiles.map((file) => {
      const type = getFileType(file);
      return {
        file,
        preview: type === 'image' ? URL.createObjectURL(file) : undefined,
        type,
      };
    });
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg'],
      'application/pdf': ['.pdf'],
      'text/*': ['.txt', '.md'],
    },
  });

  const removeFile = (index: number) => {
    setPendingFiles((prev) => {
      const file = prev[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleTextSubmit = async () => {
    if (!textContent.trim()) return;
    await createMemoMutation.mutateAsync({
      type: 'text',
      content: textContent.trim(),
    });
  };

  const handleFilesUpload = async () => {
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    try {
      for (const pending of pendingFiles) {
        const uploadResult = await uploadApi.uploadFile(pending.file);

        if (uploadResult.data) {
          const memoType = pending.type === 'image' ? 'image' :
                          pending.type === 'audio' ? 'audio_file' : 'file';

          await memosApi.create({
            type: memoType,
            storage_path: uploadResult.data.path,
            file_name: pending.file.name,
            mime_type: pending.file.type,
            file_size: pending.file.size,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['memos'] });
      toast.success(`${pendingFiles.length} file caricati!`);

      pendingFiles.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      setPendingFiles([]);
    } catch {
      toast.error('Errore durante il caricamento');
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (type: 'image' | 'audio' | 'file') => {
    switch (type) {
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'audio':
        return <Music className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Cattura" />

      <div className="flex-1 p-6">
        <Tabs defaultValue="text" className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="text" className="data-[state=active]:bg-zinc-800">
              <FileText className="mr-2 h-4 w-4" />
              Testo
            </TabsTrigger>
            <TabsTrigger value="file" className="data-[state=active]:bg-zinc-800">
              <Upload className="mr-2 h-4 w-4" />
              File
            </TabsTrigger>
            <TabsTrigger value="audio" className="data-[state=active]:bg-zinc-800">
              <Mic className="mr-2 h-4 w-4" />
              Audio
            </TabsTrigger>
          </TabsList>

          {/* Text Tab */}
          <TabsContent value="text">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Nuovo Memo di Testo</CardTitle>
                <CardDescription className="text-zinc-400">
                  Scrivi o incolla il testo che vuoi salvare
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Scrivi qui il tuo memo..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="min-h-[200px] bg-zinc-800 border-zinc-700 text-white resize-none"
                />
                <div className="flex justify-between items-center">
                  <p className="text-sm text-zinc-400">
                    {textContent.length} caratteri
                  </p>
                  <Button
                    onClick={handleTextSubmit}
                    disabled={!textContent.trim() || createMemoMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {createMemoMutation.isPending ? 'Salvando...' : 'Salva Memo'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* File Tab */}
          <TabsContent value="file">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Carica File</CardTitle>
                <CardDescription className="text-zinc-400">
                  Trascina file o clicca per selezionare (immagini, audio, PDF, testo)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                    transition-colors
                    ${isDragActive
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                    }
                  `}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
                  {isDragActive ? (
                    <p className="text-blue-400">Rilascia i file qui...</p>
                  ) : (
                    <>
                      <p className="text-zinc-300">
                        Trascina i file qui, o clicca per selezionare
                      </p>
                      <p className="text-sm text-zinc-500 mt-2">
                        Supportati: immagini, audio, PDF, file di testo
                      </p>
                    </>
                  )}
                </div>

                {/* Pending Files List */}
                {pendingFiles.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-zinc-300">
                        File in attesa ({pendingFiles.length})
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          pendingFiles.forEach((f) => {
                            if (f.preview) URL.revokeObjectURL(f.preview);
                          });
                          setPendingFiles([]);
                        }}
                        className="text-zinc-400 hover:text-red-400"
                      >
                        Rimuovi tutti
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {pendingFiles.map((pending, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg"
                        >
                          {pending.preview ? (
                            <img
                              src={pending.preview}
                              alt={pending.file.name}
                              className="h-12 w-12 object-cover rounded"
                            />
                          ) : (
                            <div className="h-12 w-12 flex items-center justify-center bg-zinc-700 rounded">
                              {getFileIcon(pending.type)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">
                              {pending.file.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {pending.type}
                              </Badge>
                              <span className="text-xs text-zinc-400">
                                {(pending.file.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(index)}
                            className="text-zinc-400 hover:text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={handleFilesUpload}
                      disabled={isUploading}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {isUploading
                        ? 'Caricamento in corso...'
                        : `Carica ${pendingFiles.length} file`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audio Tab */}
          <TabsContent value="audio">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Registrazione Audio</CardTitle>
                <CardDescription className="text-zinc-400">
                  La registrazione audio è disponibile solo nella versione mobile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                    <Mic className="h-8 w-8 text-zinc-400" />
                  </div>
                  <p className="text-zinc-400 mb-2">
                    Per registrare audio, usa l&apos;app mobile MOCA
                  </p>
                  <p className="text-sm text-zinc-500">
                    Puoi comunque caricare file audio esistenti dalla tab &quot;File&quot;
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
