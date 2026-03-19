export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: string;
  description: string;
  handler: () => void;
  category: 'navigation' | 'actions' | 'ui' | 'data';
}

export interface KeyboardShortcutConfig {
  [actionId: string]: {
    key: string;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
    description: string;
    category: 'navigation' | 'actions' | 'ui' | 'data';
  };
}

export interface KeyboardContextType {
  shortcuts: KeyboardShortcut[];
  registerShortcut: (shortcut: Omit<KeyboardShortcut, 'action'> & { action: string }) => void;
  unregisterShortcut: (action: string) => void;
  updateShortcut: (action: string, key: string, modifiers?: Partial<Pick<KeyboardShortcut, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>>) => void;
  getShortcut: (action: string) => KeyboardShortcut | undefined;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  showHelp: boolean;
  toggleHelp: () => void;
}
