export interface ContextMenuItem {
  label?: string;
  icon?: string;
  action?: () => void;
  disabled?: boolean;
  type?: 'item' | 'separator';
  danger?: boolean;
  shortcut?: string;
  children?: ContextMenuItem[]; // For submenus in the future
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}
