'use client';

/**
 * Gimmick · Obsidian — Shell icon set.
 *
 * The DC prototypes use hand-drawn 16px glyphs; per README we substitute the
 * repo's icon library (@tabler/icons-react) keeping weight/size coherent
 * (stroke ~1.6, ~15–16px). Keyed by the DC glyph names so the data-driven
 * shell (nav, sidebar, inspector) stays readable.
 */
import * as React from 'react';
import {
  IconSearch, IconSparkles, IconBell, IconSettings,
  IconLayoutSidebar, IconLayoutSidebarRight,
  IconChevronRight, IconChevronLeft, IconChevronDown,
  IconPin, IconPlus, IconHome, IconBriefcase, IconUser, IconFolder,
  IconSun, IconRipple, IconCurrencyEuro,
  IconPencil, IconList, IconAffiliate, IconNote, IconCheckbox,
  IconCalendar, IconCalendarEvent, IconCalendarTime, IconClock,
  IconTag, IconPhone, IconCircleCheck, IconAlertCircle,
  IconLayoutGrid, IconLayoutDashboard, IconLayoutKanban, IconEye,
  IconArrowsSort, IconFilter, IconCategory,
  IconCamera, IconVideo, IconPhoto, IconAlignLeft, IconMicrophone, IconPaperclip,
  IconSend,
  IconCopy, IconClipboard, IconTrash,
  type IconProps as TablerIconProps,
} from '@tabler/icons-react';

export type ShellIconName =
  | 'search' | 'sparkles' | 'bell' | 'gear'
  | 'collapse' | 'panel'
  | 'chevR' | 'chevL' | 'chevD'
  | 'pin' | 'plus' | 'home' | 'briefcase' | 'person' | 'folder'
  | 'sun' | 'wave' | 'euro'
  | 'edit' | 'list' | 'flow' | 'note' | 'todo'
  | 'calendar' | 'allday' | 'chrono' | 'clock' | 'timed'
  | 'tags' | 'call' | 'check' | 'due'
  | 'tiles' | 'canvas' | 'kanban' | 'panopticon'
  | 'sort' | 'filter' | 'group'
  | 'photo' | 'video' | 'gallery' | 'text' | 'voice' | 'file'
  | 'send'
  | 'copy' | 'paste' | 'trash';

const MAP: Record<ShellIconName, React.ComponentType<TablerIconProps>> = {
  search: IconSearch, sparkles: IconSparkles, bell: IconBell, gear: IconSettings,
  collapse: IconLayoutSidebar, panel: IconLayoutSidebarRight,
  chevR: IconChevronRight, chevL: IconChevronLeft, chevD: IconChevronDown,
  pin: IconPin, plus: IconPlus, home: IconHome, briefcase: IconBriefcase, person: IconUser, folder: IconFolder,
  sun: IconSun, wave: IconRipple, euro: IconCurrencyEuro,
  edit: IconPencil, list: IconList, flow: IconAffiliate, note: IconNote, todo: IconCheckbox,
  calendar: IconCalendar, allday: IconCalendarEvent, chrono: IconCalendarTime, clock: IconClock, timed: IconClock,
  tags: IconTag, call: IconPhone, check: IconCircleCheck, due: IconAlertCircle,
  tiles: IconLayoutGrid, canvas: IconLayoutDashboard, kanban: IconLayoutKanban, panopticon: IconEye,
  sort: IconArrowsSort, filter: IconFilter, group: IconCategory,
  photo: IconCamera, video: IconVideo, gallery: IconPhoto, text: IconAlignLeft, voice: IconMicrophone, file: IconPaperclip,
  send: IconSend,
  copy: IconCopy, paste: IconClipboard, trash: IconTrash,
};

export interface IconProps extends Omit<TablerIconProps, 'ref'> {
  name: ShellIconName;
}

/** Render a shell glyph by DC name. Defaults to size 16, stroke 1.6. */
export function Icon({ name, size = 16, stroke = 1.6, ...rest }: IconProps) {
  const Cmp = MAP[name];
  return <Cmp size={size} stroke={stroke} {...rest} />;
}
