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
  Table,
  TableRow,
  Toast,
} from './surfaces';
export type {
  ChipProps,
  CardProps,
  AvatarProps,
  SkeletonProps,
  ListRowProps,
  TableRowProps,
  ToastProps,
  ToastTone,
} from './surfaces';

export { Modal, Sheet } from './overlays';
export type { ModalProps, SheetProps } from './overlays';
