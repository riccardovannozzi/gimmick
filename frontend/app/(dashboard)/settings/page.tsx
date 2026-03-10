'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, Bell, Shield, Palette, LogOut } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth-store';

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);

  const handleLogout = async () => {
    await signOut();
    toast.success('Logout effettuato');
    router.push('/login');
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Impostazioni" />

      <div className="flex-1 p-6 space-y-6 max-w-3xl overflow-y-auto">
        {/* Profile Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">Profilo</CardTitle>
                <CardDescription className="text-zinc-400">
                  Gestisci le informazioni del tuo account
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-zinc-800 border-zinc-700 text-zinc-400"
              />
              <p className="text-xs text-zinc-500">
                L&apos;email non può essere modificata
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-600 flex items-center justify-center">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">Notifiche</CardTitle>
                <CardDescription className="text-zinc-400">
                  Configura le preferenze di notifica
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-300">
                  Notifiche push
                </p>
                <p className="text-xs text-zinc-500">
                  Ricevi notifiche per nuovi memo
                </p>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>
            <Separator className="bg-zinc-800" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-300">
                  Sincronizzazione automatica
                </p>
                <p className="text-xs text-zinc-500">
                  Sincronizza automaticamente i memo in background
                </p>
              </div>
              <Switch
                checked={autoSync}
                onCheckedChange={setAutoSync}
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center">
                <Palette className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">Aspetto</CardTitle>
                <CardDescription className="text-zinc-400">
                  Personalizza l&apos;interfaccia
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-300">
                  Tema scuro
                </p>
                <p className="text-xs text-zinc-500">
                  Attualmente è l&apos;unico tema disponibile
                </p>
              </div>
              <Switch checked={true} disabled />
            </div>
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">Sicurezza</CardTitle>
                <CardDescription className="text-zinc-400">
                  Gestisci la sicurezza del tuo account
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="border-zinc-700 text-zinc-300">
              Cambia Password
            </Button>
            <Separator className="bg-zinc-800" />
            <div>
              <Button
                variant="destructive"
                onClick={handleLogout}
                className="w-full"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
