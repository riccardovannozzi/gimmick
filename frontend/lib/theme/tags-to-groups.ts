/**
 * Gimmick · Obsidian — Adapter `Tag[]` → `SidebarGroup[]`.
 *
 * Trasforma i tag reali dell'utente nel modello dati della Sidebar Obsidian
 * (`components/shell/Sidebar`). Replica il raggruppamento per `tag_type` della
 * vecchia sidebar arcade (`components/layout/sidebar.tsx`): ordine, colore ed
 * etichetta provengono dai tag-type configurati; i tag root/archiviati sono
 * esclusi. Funzione pura, facilmente testabile e riusabile dallo shell live.
 */
import type { Tag } from '@/types';
import type { SidebarGroup, ShellIconName } from '@/components/shell';

/** Ordine di fallback quando non ci sono tag-type configurati. */
const FALLBACK_TYPE_ORDER = ['project', 'person', 'context', 'place', 'topic'] as const;

/** Mappa tag_type → glyph dello shell (i tag-type custom ricadono su `tags`). */
const TAG_TYPE_ICON: Record<string, ShellIconName> = {
  project: 'folder',
  person: 'person',
  context: 'tags',
  place: 'home',
  topic: 'tags',
};

/** Metadati minimi di un tag-type (sottoinsieme di ciò che espone useTagTypes). */
export interface TagTypeMeta {
  slug: string;
  name?: string;
  color?: string;
}

export interface TagsToGroupsResult {
  groups: SidebarGroup[];
  /** Totale tag non-root (badge header sidebar). */
  count: number;
}

export function tagsToSidebarGroups(
  tags: Tag[],
  tagTypes: TagTypeMeta[] = [],
): TagsToGroupsResult {
  const nonRoot = tags.filter((t) => !t.is_root && !t.is_archived);

  // Ordine dei gruppi: prima i tag-type configurati, poi eventuali tipi extra
  // presenti sui tag ma non ancora in lista.
  const order: string[] =
    tagTypes.length > 0 ? tagTypes.map((t) => t.slug) : [...FALLBACK_TYPE_ORDER];
  for (const tag of nonRoot) {
    if (tag.tag_type && !order.includes(tag.tag_type)) order.push(tag.tag_type);
  }

  const groups: SidebarGroup[] = order
    .map((slug) => {
      const meta = tagTypes.find((t) => t.slug === slug);
      const children = nonRoot
        .filter((t) => t.tag_type === slug)
        .map((t) => ({ id: t.id, name: t.name, pinned: t.is_pinned }));
      return {
        id: slug,
        name: (meta?.name ?? slug).toUpperCase(),
        icon: TAG_TYPE_ICON[slug] ?? 'tags',
        color: meta?.color,
        defaultOpen: true,
        children,
      } satisfies SidebarGroup;
    })
    .filter((g) => (g.children?.length ?? 0) > 0);

  return { groups, count: nonRoot.length };
}
