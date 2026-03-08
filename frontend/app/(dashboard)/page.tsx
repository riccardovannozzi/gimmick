'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, LayoutGrid, TrendingUp } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { memosApi, tilesApi } from '@/lib/api';
import type { MemoType } from '@/types';

const statConfig = [
  { name: 'Tiles', icon: LayoutGrid, color: 'text-blue-500', key: 'tiles' },
  { name: 'Memos', icon: FileText, color: 'text-zinc-300', key: 'memos' },
  { name: 'Spazio Utilizzato', icon: TrendingUp, color: 'text-green-500', key: 'size' },
] as const;

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
  const { data: memosData } = useQuery({
    queryKey: ['memos', { limit: 5 }],
    queryFn: () => memosApi.list({ limit: 5 }),
  });

  const { data: statsData } = useQuery({
    queryKey: ['memos-stats'],
    queryFn: () => memosApi.stats(),
  });

  const { data: tilesData } = useQuery({
    queryKey: ['tiles', { page: 1, limit: 1 }],
    queryFn: () => tilesApi.list({ page: 1, limit: 1 }),
  });

  const recentMemos = memosData?.data || [];
  const totalTiles = tilesData?.pagination?.total || 0;

  const stats = statsData?.data;
  const typeCounts = stats?.counts || {};
  const totalMemos = stats?.total || 0;
  const totalSize = stats?.totalSize || 0;
  const dateCounts = stats?.dateCounts || {};

  const getStatValue = (key: string) => {
    if (key === 'tiles') return totalTiles;
    if (key === 'memos') return totalMemos;
    if (key === 'size') return `${(totalSize / 1024 / 1024).toFixed(1)} MB`;
    return typeCounts[key] || 0;
  };

  // Sort dates descending, take last 7
  const sortedDates = Object.entries(dateCounts)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7);

  const formatDate = (isoDate: string) => {
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  };

  const todayISO = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col h-full">
      <Header title="Analytics" />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Stat cards grid */}
        <div className="grid gap-4 grid-cols-3">
          {statConfig.map((stat) => (
            <Card key={stat.key} className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">
                  {stat.name}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {getStatValue(stat.key)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Two-column layout: Distribution + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  const percentage = totalMemos > 0 ? (count / totalMemos) * 100 : 0;
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
                    <div className="w-24 text-sm text-zinc-400">{formatDate(date)}</div>
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

        {/* Recent memos */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Memos recenti</CardTitle>
          </CardHeader>
          <CardContent>
            {recentMemos.length === 0 ? (
              <p className="text-zinc-400">Nessun memo trovato</p>
            ) : (
              <div className="space-y-3">
                {recentMemos.map((memo) => (
                  <div
                    key={memo.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {memo.file_name || memo.type}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {new Date(memo.created_at).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500 capitalize">
                      {memo.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
