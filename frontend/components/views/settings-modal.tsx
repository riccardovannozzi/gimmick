'use client';

/**
 * Gimmick · Obsidian — Le impostazioni come MODALE.
 *
 * Erano una pagina, `/settings`, e la pagina era il posto sbagliato: i settings
 * non sono una vista. Non hanno una linguetta nella barra (`VIEW_TO_PATH` in
 * ObsidianShell non li elenca), quindi aprendoli lo shell restava con Tiles
 * acceso mentre il corpo mostrava tutt'altro, e per uscirne dovevi premere
 * indietro o scegliere una vista a caso — l'app non sapeva dirti da dove eri
 * arrivato.
 *
 * In modale il posto da cui li apri resta sotto, e chiudere ti rimette
 * esattamente lì. Il contenuto è lo STESSO `SettingsLive` di prima: qui dentro
 * cambia solo la cornice, non i pannelli.
 */
import { Modal } from '@/components/primitives';
import { SettingsLive } from '@/components/views/settings-live';
import { useSettingsModal } from '@/store/settings-modal-store';

export function SettingsModal() {
  const open = useSettingsModal((s) => s.open);
  const setOpen = useSettingsModal((s) => s.setOpen);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Impostazioni"
      className="ob-modal--settings"
    >
      {/* La chiusura passa anche di sotto: l'uscita dall'account porta a
          `/login`, e la modale deve essere già chiusa quando ci si riaccede. */}
      <SettingsLive onClose={() => setOpen(false)} />
    </Modal>
  );
}
