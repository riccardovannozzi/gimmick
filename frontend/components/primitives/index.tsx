/**
 * Gimmick · Obsidian — Primitive components barrel.
 *
 * Strangler migration: these read the `--ob-*` Obsidian tokens and live
 * alongside the legacy shadcn/pixel components. Light/dark is driven by the
 * `data-theme` attribute on an ancestor (see app/obsidian.css). Styles live in
 * app/obsidian-primitives.css.
 *
 * Visual reference: design_handoff_obsidian/GimmickObsidian.dc.html.
 */
export {
  Button,
  IconButton,
  ToolButton,
  ToolWord,
  Field,
  Select,
  Dropdown,
  Toggle,
  SegmentedControl,
} from './controls';
export type {
  ButtonProps,
  ButtonVariant,
  ButtonSize,
  IconButtonProps,
  ToolButtonProps,
  ToolWordProps,
  FieldProps,
  SelectProps,
  SelectOption,
  DropdownProps,
  DropdownOption,
  ToggleProps,
  SegmentedControlProps,
  SegmentedItem,
} from './controls';

export {
  Chip,
  Badge,
  Card,
  Avatar,
  Skeleton,
  ListRow,
  Toast,
} from './surfaces';
export type {
  ChipProps,
  CardProps,
  AvatarProps,
  SkeletonProps,
  ListRowProps,
  ToastProps,
  ToastTone,
} from './surfaces';

// La tabella condivisa da Sparks, Tiles, Tags e Contatti, e la fascia dei
// comandi che le sta sopra. Vedi `./table.tsx`.
export {
  TableCard,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableText,
  TableDash,
  TableEmpty,
  tableAlign,
  Toolbar,
  ToolbarGap,
  ToolGroup,
  ToolSep,
} from './table';
export type {
  TableColumn,
  TableCardProps,
  TableProps,
  TableRowProps,
  TableCellProps,
  ToolbarProps,
} from './table';

export { Modal, Sheet } from './overlays';
export type { ModalProps, SheetProps } from './overlays';
