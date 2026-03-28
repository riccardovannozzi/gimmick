'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { IconUser, IconBell, IconShield, IconPalette, IconLogout, IconPin, IconBolt, IconClock, IconCalendar, IconBrush, IconMoodSmile } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useActionColorsQuery } from '@/store/action-colors-store';
import { GIMMICK_PALETTE, getColorName } from '@/lib/palette';
import { PatternsModal } from '@/components/patterns/patterns-modal';
import { StatusIconsModal } from '@/components/status-icons/status-icons-modal';
import type { ActionType } from '@/types';

const ACTION_LABELS: { type: ActionType; label: string; icon: typeof IconPin }[] = [
  { type: 'none', label: 'Appunto', icon: IconPin },
  { type: 'anytime', label: 'Da fare', icon: IconBolt },
  { type: 'deadline', label: 'Scadenza', icon: IconClock },
  { type: 'event', label: 'Evento', icon: IconCalendar },
];

function ColorPickerGrid({
  selectedColor,
  onSelect,
}: {
  selectedColor: string;
  onSelect: (hex: string) => void;
}) {
  return (
    <div className="inline-grid grid-cols-5 rounded-md overflow-hidden" style={{ gap: 2 }}>
      {GIMMICK_PALETTE.map((color) => {
        const isSelected = color.hex.toLowerCase() === selectedColor.toLowerCase();
        return (
          <button
            key={color.id}
            onClick={() => onSelect(color.hex)}
            title={color.name}
            className="w-8 h-8 relative"
            style={{ backgroundColor: color.hex }}
          >
            {isSelected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white shadow-sm" style={{ boxShadow: '0 0 3px rgba(0,0,0,0.5)' }} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [pickerAction, setPickerAction] = useState<ActionType | null>(null);
  const [patternsOpen, setPatternsOpen] = useState(false);
  const [statusIconsOpen, setStatusIconsOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const { actionColors, updateActionColor } = useActionColorsQuery();

  useEffect(() => {
    if (!pickerAction) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerAction(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pickerAction]);

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
                <CardTitle className="text-white">Colori delle azioni</CardTitle>
                <CardDescription className="text-zinc-400">
                  Associa un colore a ogni tipo di azione
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {ACTION_LABELS.map(({ type, label, icon: ActionIcon }) => {
              const color = actionColors[type];
              return (
                <button
                  key={type}
                  ref={(el) => { triggerRefs.current[type] = el; }}
                  onClick={() => {
                    const el = triggerRefs.current[type];
                    if (el) {
                      const rect = el.getBoundingClientRect();
                      setPickerPos({ top: rect.bottom + 4, left: rect.left });
                    }
                    setPickerAction(pickerAction === type ? null : type);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-zinc-800/60 transition-colors text-left"
                >
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <ActionIcon className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span className="text-sm font-medium text-zinc-200 flex-1">{label}</span>
                  <span className="text-xs text-zinc-500">{getColorName(color)}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Patterns Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <IconBrush className="h-5 w-5 text-zinc-400" />
              <div>
                <CardTitle className="text-white">Tile Patterns</CardTitle>
                <CardDescription className="text-zinc-400">
                  Gestisci i pattern visivi dei tile
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300"
              onClick={() => setPatternsOpen(true)}
            >
              Gestisci patterns
            </Button>
          </CardContent>
        </Card>

        {/* Tile Status Icons Section */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <IconMoodSmile className="h-5 w-5 text-zinc-400" />
              <div>
                <CardTitle className="text-white">Tile Status Icons</CardTitle>
                <CardDescription className="text-zinc-400">
                  Gestisci le icone di stato da assegnare ai tile
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-300"
              onClick={() => setStatusIconsOpen(true)}
            >
              Gestisci status icons
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

      {/* Patterns modal */}
      <PatternsModal open={patternsOpen} onOpenChange={setPatternsOpen} />
      <StatusIconsModal open={statusIconsOpen} onOpenChange={setStatusIconsOpen} />

      {/* Color picker popup */}
      {pickerAction && createPortal(
        <div
          ref={pickerRef}
          className="fixed rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl p-3"
          style={{ top: pickerPos.top, left: pickerPos.left, zIndex: 9999 }}
        >
          <ColorPickerGrid
            selectedColor={actionColors[pickerAction]}
            onSelect={(hex) => {
              updateActionColor(pickerAction, hex);
              setPickerAction(null);
              toast.success('Colore aggiornato');
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
