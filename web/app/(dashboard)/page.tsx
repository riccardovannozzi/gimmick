'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, Image, Mic, File, TrendingUp } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { memosApi } from '@/lib/api';

const stats = [
  { name: 'Totale Memos', icon: FileText, color: 'text-blue-500' },
  { name: 'Foto', icon: Image, color: 'text-green-500' },
  { name: 'Audio', icon: Mic, color: 'text-red-500' },
  { name: 'File', icon: File, color: 'text-yellow-500' },
];

export default function DashboardPage() {
  const { data: memosData } = useQuery({
    queryKey: ['memos', { limit: 5 }],
    queryFn: () => memosApi.list({ limit: 5 }),
  });

  const recentMemos = memosData?.data || [];
  const totalMemos = memosData?.pagination?.total || 0;

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" />

      <div className="flex-1 p-6 space-y-6">
        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card key={stat.name} className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">
                  {stat.name}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {index === 0 ? totalMemos : '-'}
                </div>
              </CardContent>
            </Card>
          ))}
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
