'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { IconUser, IconBell, IconShield, IconPalette, IconLogout, IconBolt, IconClock, IconCalendar, IconArrowUp, IconBrush, IconMoodSmile } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useActionColorsQuery } from '@/store/action-colors-store';
import { ColorPickerGrid } from '@/components/ui/color-picker-grid';
import { StatusesModal } from '@/components/statuses/statuses-modal';
import { TypeIconsModal } from '@/components/type-icons/type-icons-modal';
import type { ActionType } from '@/types';

type ActionDef = { type: ActionType; label: string; icon: typeof IconArrowUp | null };
const ACTION_LABELS: ActionDef[] = [
  { type: 'none',     label: 'Notes',    icon: null },
  { type: 'anytime',  label: 'To Do',    icon: IconArrowUp },
  { type: 'deadline', label: 'Deadline', icon: IconBolt },
  { type: 'allday',   label: 'All Day',  icon: IconCalendar },
  { type: 'event',    label: 'Timed',    icon: IconClock },
];


export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [editingAction, setEditingAction] = useState<ActionType | null>(null);
  const [statusesOpen, setStatusesOpen] = useState(false);
  const [typeIconsOpen, setTypeIconsOpen] = useState(false);

  const { actionColors, updateActionColor } = useActionColorsQuery();

  const handleLogout = async () => {
    await signOut();
    toast.success('Logout effettuato');
    router.push('/login');
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Impostazioni" />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Profile Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <IconUser className="h-5 w-5 text-zinc-400" />
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

        {/* Action Colors Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <IconPalette className="h-5 w-5 text-zinc-400" />
              <div>
                <CardTitle className="text-white">Style of actions</CardTitle>
                <CardDescription className="text-zinc-400">
                  Associa un colore a ogni tipo di azione
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {ACTION_LABELS.map(({ type, label, icon: ActionIcon }) => {
              const color = actionColors[type];
              const isNotes = type === 'none';
              return (
                <button
                  key={type}
                  onClick={() => setEditingAction(type)}
                  className="flex items-center gap-3 w-full rounded-lg bg-zinc-800/30 hover:bg-zinc-800/60 px-3 py-2 transition-colors text-left"
                >
                  {isNotes || !ActionIcon ? (
                    <div className="w-7 h-7 shrink-0" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      <ActionIcon className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-zinc-200 flex-1">{label}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Statuses Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <IconBrush className="h-5 w-5 text-zinc-400" />
              <div>
                <CardTitle className="text-white">Tile Statuses</CardTitle>
                <CardDescription className="text-zinc-400">
                  Gestisci gli status visivi dei tile
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300"
              onClick={() => setStatusesOpen(true)}
            >
              Gestisci statuses
            </Button>
          </CardContent>
        </Card>

        {/* Tile Type Icons Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <IconMoodSmile className="h-5 w-5 text-zinc-400" />
              <div>
                <CardTitle className="text-white">Tile Type Icons</CardTitle>
                <CardDescription className="text-zinc-400">
                  Gestisci le icone di tipo da assegnare ai tile
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300"
              onClick={() => setTypeIconsOpen(true)}
            >
              Gestisci type icons
            </Button>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <IconBell className="h-5 w-5 text-zinc-400" />
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
              <IconPalette className="h-5 w-5 text-zinc-400" />
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
              <IconShield className="h-5 w-5 text-zinc-400" />
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
                <IconLogout className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statuses modal */}
      <StatusesModal open={statusesOpen} onOpenChange={setStatusesOpen} />
      <TypeIconsModal open={typeIconsOpen} onOpenChange={setTypeIconsOpen} />

      {/* Style-of-action editor modal */}
      <Dialog open={editingAction !== null} onOpenChange={(o) => !o && setEditingAction(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
          {editingAction && (() => {
            const def = ACTION_LABELS.find((a) => a.type === editingAction)!;
            const color = actionColors[editingAction];
            const ActionIcon = def.icon;
            const isNotes = editingAction === 'none';
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    {!isNotes && ActionIcon && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
                        <ActionIcon className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                    {def.label}
                  </DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Colore associato a questa action.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {isNotes ? (
                    <p className="text-xs text-zinc-500 italic text-center py-4">
                      Notes non ha un colore personalizzato.
                    </p>
                  ) : (
                    <>
                      {/* Preview */}
                      <div className="flex justify-center py-2">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
                          {ActionIcon && <ActionIcon className="h-7 w-7 text-white" />}
                        </div>
                      </div>

                      {/* Color picker */}
                      <div>
                        <label className="text-[11px] text-zinc-400 mb-2 block uppercase tracking-wide">Colore</label>
                        <ColorPickerGrid
                          selectedColor={color}
                          onSelect={(hex) => {
                            if (!hex) return;
                            updateActionColor(editingAction, hex);
                            toast.success('Colore aggiornato');
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
