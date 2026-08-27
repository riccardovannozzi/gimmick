'use client';

/**
 * `/settings` — non è più una pagina, è una PORTA.
 *
 * La gestione delle impostazioni vive ora nella modale dello shell
 * (`components/views/settings-modal.tsx`), raggiungibile dall'ingranaggio in
 * barra da qualunque vista. La rotta resta per i link già in giro — bookmark,
 * cronologia, `router.push` dimenticati: apre la modale e rimette l'indirizzo
 * sulla vista di default, così l'URL non racconta una pagina che non esiste.
 *
 * `replace`, non `push`: altrimenti il tasto indietro riporterebbe qui, e da
 * qui si rimbalzerebbe di nuovo in avanti.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSettingsModal } from '@/store/settings-modal-store';

export default function SettingsPage() {
  const router = useRouter();
  const setOpen = useSettingsModal((s) => s.setOpen);

  useEffect(() => {
    setOpen(true);
    router.replace('/tiles');
  }, [router, setOpen]);

  return null;
}
