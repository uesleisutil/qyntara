import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { KeyboardContextType, KeyboardShortcut } from '../types/keyboard';

const KeyboardContext = createContext<KeyboardContextType | undefined>(undefined);

export const useKeyboard = (): KeyboardContextType => {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboard must be used within a KeyboardProvider');
  }
  return context;
};

interface KeyboardProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'dashboard_keyboard_shortcuts';

export const KeyboardProvider: React.FC<KeyboardProviderProps> = ({ children }) => {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  const registerShortcut = useCallback((shortcut: Omit<KeyboardShortcut, 'action'> & { action: string }) => {
    setShortcuts((prev) => {
      const filtered = prev.filter((s) => s.action !== shortcut.action);
      return [...filtered, shortcut as KeyboardShortcut];
    });
  }, []);

  const unregisterShortcut = useCallback((action: string) => {
    setShortcuts((prev) => prev.filter((s) => s.action !== action));
  }, []);

  const updateShortcut = useCallback((
    action: string,
    key: string,
    modifiers?: Partial<Pick<KeyboardShortcut, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>>
  ) => {
    setShortcuts((prev) => {
      return prev.map((s) =>
        s.action === action
          ? { ...s, key, ...modifiers }
          : s
      );
    });
  }, []);

  const getShortcut = useCallback((action: string): KeyboardShortcut | undefined => {
    return shortcuts.find((s) => s.action === action);
  }, [shortcuts]);

  const toggleHelp = useCallback(() => {
    setShowHelp((prev) => !prev);
  }, []);

  // Global keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape key to work in inputs
        if (e.key !== 'Escape') {
          return;
        }
      }

      // Find matching shortcut
      const matchingShortcut = shortcuts.find((shortcut) => {
        const keyMatches = shortcut.key.toLowerCase() === e.key.toLowerCase();
        const ctrlMatches = !!shortcut.ctrlKey === e.ctrlKey;
        const shiftMatches = !!shortcut.shiftKey === e.shiftKey;
        const altMatches = !!shortcut.altKey === e.altKey;
        const metaMatches = !!shortcut.metaKey === e.metaKey;

        return keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches;
      });

      if (matchingShortcut) {
        e.preventDefault();
        matchingShortcut.handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);

  // Load custom shortcuts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const customShortcuts = JSON.parse(stored);
        // Apply custom key bindings to registered shortcuts
        setShortcuts((prev) =>
          prev.map((s) => {
            const custom = customShortcuts[s.action];
            return custom ? { ...s, ...custom } : s;
          })
        );
      }
    } catch (err) {
      console.error('Failed to load custom shortcuts:', err);
    }
  }, []);

  // Save custom shortcuts to localStorage
  const saveShortcuts = useCallback(() => {
    try {
      const customShortcuts = shortcuts.reduce((acc, s) => {
        acc[s.action] = {
          key: s.key,
          ctrlKey: s.ctrlKey,
          shiftKey: s.shiftKey,
          altKey: s.altKey,
          metaKey: s.metaKey
        };
        return acc;
      }, {} as Record<string, any>);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(customShortcuts));
    } catch (err) {
      console.error('Failed to save shortcuts:', err);
    }
  }, [shortcuts]);

  useEffect(() => {
    saveShortcuts();
  }, [shortcuts, saveShortcuts]);

  return (
    <KeyboardContext.Provider
      value={{
        shortcuts,
        registerShortcut,
        unregisterShortcut,
        updateShortcut,
        getShortcut,
        enabled,
        setEnabled,
        showHelp,
        toggleHelp
      }}
    >
      {children}
    </KeyboardContext.Provider>
  );
};

export default KeyboardContext;
