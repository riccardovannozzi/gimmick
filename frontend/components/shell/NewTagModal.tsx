'use client';

/**
 * Gimmick · Obsidian — Nuovo tag dentro un gruppo della sidebar.
 *
 * Il gruppo NON è un campo da scegliere: è il contesto da cui la modale è stata
 * aperta, e si vede in cima come un dato di fatto. È la differenza con la
 * modale della pagina Tags, dove il tipo è una delle domande — lì stai creando
 * un tag e basta, qui stai creando un tag DENTRO «Golfo del Sole», perché è lì
 * che hai premuto il tasto destro. Ripetere la domanda darebbe la possibilità
 * di rispondere diversamente da come si è chiesto, che è solo un modo di
 * introdurre un errore.
 *
 * Gli alias restano, perché sono la cosa che rende un tag utile all'indicizzazione
 * AI e l'unico momento in cui viene naturale scriverli è questo.
 */
import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as TablerIcons from '@tabler/icons-react';
import { Modal, Button, Field } from '@/components/primitives';
import { tagsApi } from '@/lib/api';
import { Icon, type ShellIconName } from './icons';
import type { SidebarGroup } from './Sidebar';

const TablerMap = TablerIcons as unknown as Record<
  string,
  React.ComponentType<{ size?: number; color?: string; stroke?: number }>
>;

/** «alias uno, alias due» → `['alias uno', 'alias due']`. I vuoti si scartano. */
function parseAliases(raw: string): string[] {
  return raw.split(',').map((a) => a.trim()).filter(Boolean);
}

export interface NewTagModalProps {
  /** Il gruppo in cui nasce il tag. `null` = modale chiusa. */
  group: SidebarGroup | null;
  onClose: () => void;
  /** Il tag appena creato, se il parent vuole selezionarlo o aprirlo. */
  onCreated?: (tagId: string) => void;
}

export function NewTagModal({ group, onClose, onCreated }: NewTagModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [aliases, setAliases] = React.useState('');

  // I campi si svuotano ALL'APERTURA e non alla chiusura: chiudere e riaprire
  // subito con dentro il nome di prima è il modo di creare due volte lo stesso
  // tag senza accorgersene.
  React.useEffect(() => {
    if (group) { setName(''); setAliases(''); }
  }, [group]);

  const create = useMutation({
    mutationFn: (vars: { name: string; aliases: string[]; tag_type: string }) => tagsApi.create(vars),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success(`Tag "${res.data?.name ?? name.trim()}" creato`);
      if (res.data?.id) onCreated?.(res.data.id);
      onClose();
    },
    onError: () => toast.error('Errore nella creazione del tag'),
  });

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !create.isPending;

  const submit = () => {
    if (!group || !canSubmit) return;
    create.mutate({ name: trimmed, aliases: parseAliases(aliases), tag_type: group.id });
  };

  // Il glifo del gruppo con la stessa regola della sidebar: il nome Tabler
  // salvato dal tag-type vince, altrimenti il glifo dello shell.
  const Glyph = group?.emoji ? TablerMap[group.emoji] : undefined;

  return (
    <Modal open={!!group} onClose={onClose} title="Nuovo tag" maxWidth={420}>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {/* Dove finirà. Non è decorazione: la modale si apre dal tasto destro,
            cioè da un gesto che non lascia traccia di dove è stato fatto. */}
        <div className="ob-newtag__parent">
          <span className="ob-newtag__parent-glyph">
            {Glyph
              ? <Glyph size={16} color={group?.color} stroke={1.7} />
              : <Icon name={(group?.icon ?? 'tags') as ShellIconName} size={16} color={group?.color} />}
          </span>
          <span className="ob-newtag__parent-name">{group?.name}</span>
          <span className="ob-newtag__parent-note">il tag nasce qui dentro</span>
        </div>

        <label className="ob-newtag__label">
          Nome
          <Field
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome del tag…"
          />
        </label>

        <label className="ob-newtag__label">
          Alias
          <Field
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="Separati da virgola — servono all'AI per riconoscerlo"
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
          <Button variant="secondary" size="sm" onClick={onClose}>Annulla</Button>
          {/* `type="submit"` e non un onClick: così anche Invio dai campi crea,
              che è come si compila un modulo di due righe. */}
          <Button type="submit" size="sm" disabled={!canSubmit}>
            {create.isPending ? 'Creo…' : 'Crea'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
