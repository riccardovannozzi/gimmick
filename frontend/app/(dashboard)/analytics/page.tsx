'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Calendar, FileType } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { memosApi } from '@/lib/api';
import type { MemoType } from '@/types';

const typeLabels: Record<MemoType, string> = {
  photo: 'Foto',
  image: 'Immagini',
  video: 'Video',
  audio_recording: 'Registrazioni',
  text: 'Testo',
  file: 'File',
};

const typeColors: Record<MemoType, string> = {
  photo: 'bg-blue-500',
  image: 'bg-green-500',
  video: 'bg-orange-500',
  audio_recording: 'bg-red-500',
  text: 'bg-purple-500',
  file: 'bg-yellow-500',
};

export default function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ['memos', { page: 1, limit: 1000 }],
    queryFn: () => memosApi.list({ page: 1, limit: 1000 }),
  });

  const memos = data?.data || [];
  const total = memos.length;

  // Calculate stats
  const typeCounts = memos.reduce((acc, memo) => {
    acc[memo.type] = (acc[memo.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalSize = memos.reduce((acc, memo) => acc + (memo.file_size || 0), 0);

  // Group by date
  const dateGroups = memos.reduce((acc, memo) => {
    const date = new Date(memo.created_at).toLocaleDateString('it-IT');
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedDates = Object.entries(dateGroups)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .slice(0, 7);

  // Memos today
  const today = new Date().toLocaleDateString('it-IT');
  const memosToday = dateGroups[today] || 0;

  // Most used type
  const mostUsedType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="flex flex-col h-full">
      <Header title="Analytics" />

      <div className="flex-1 p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{total}</p>
                  <p className="text-sm text-zinc-400">Memo Totali</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-600/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {(totalSize / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <p className="text-sm text-zinc-400">Spazio Utilizzato</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-purple-600/20 flex items-center justify-center">
                  <FileType className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {mostUsedType ? typeLabels[mostUsedType[0] as MemoType] : '-'}
                  </p>
                  <p className="text-sm text-zinc-400">Tipo Più Usato</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-orange-600/20 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {memosToday}
                  </p>
                  <p className="text-sm text-zinc-400">Memo Oggi</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Distribution by Type */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Distribuzione per Tipo</CardTitle>
            <CardDescription className="text-zinc-400">
              Breakdown dei memo per categoria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(typeCounts).map(([type, count]) => {
                const percentage = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">
                        {typeLabels[type as MemoType] || type}
                      </span>
                      <span className="text-zinc-400">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${typeColors[type as MemoType] || 'bg-zinc-500'} rounded-full transition-all duration-300`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {Object.keys(typeCounts).length === 0 && (
                <p className="text-center text-zinc-500 py-8">
                  Nessun dato disponibile
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Attività Recente</CardTitle>
            <CardDescription className="text-zinc-400">
              Memo creati negli ultimi 7 giorni
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedDates.map(([date, count]) => (
                <div key={date} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-zinc-400">{date}</div>
                  <div className="flex-1">
                    <div className="h-6 bg-zinc-800 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded transition-all duration-300"
                        style={{
                          width: `${Math.min((count / Math.max(...sortedDates.map(d => d[1]))) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right text-sm text-zinc-300">
                    {count}
                  </div>
                </div>
              ))}
              {sortedDates.length === 0 && (
                <p className="text-center text-zinc-500 py-8">
                  Nessuna attività recente
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
