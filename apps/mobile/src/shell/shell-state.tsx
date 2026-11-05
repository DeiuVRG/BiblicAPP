import { usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { SectionKey } from './sections';

// What the shell remembers between its parts: which section drawer is open (one at a time) and
// whether the phone menu is. It is shared by every screen's bars, because the stack keeps the
// screens a reader came from mounted under the current one: a drawer opened before a link was
// followed must not be found open on the way back. A change of route closes everything (4.3).

interface ShellState {
  openDrawer: SectionKey | null;
  setOpenDrawer(key: SectionKey | null): void;
  menuOpen: boolean;
  setMenuOpen(open: boolean): void;
}

const ShellContext = createContext<ShellState>({
  openDrawer: null,
  setOpenDrawer: () => undefined,
  menuOpen: false,
  setMenuOpen: () => undefined,
});

interface Held {
  /** The page the drawer and the menu were opened on. */
  pathname: string;
  openDrawer: SectionKey | null;
  menuOpen: boolean;
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [held, setHeld] = useState<Held>({ pathname, openDrawer: null, menuOpen: false });
  // What was opened on another page is closed: a change of route closes everything (4.3). It is
  // worked out here, from the page, rather than reset by an effect after the page has changed.
  const here: Held =
    held.pathname === pathname ? held : { pathname, openDrawer: null, menuOpen: false };

  const setOpenDrawer = useCallback(
    (openDrawer: SectionKey | null) =>
      setHeld((previous) => ({
        pathname,
        openDrawer,
        menuOpen: previous.pathname === pathname && previous.menuOpen,
      })),
    [pathname],
  );
  const setMenuOpen = useCallback(
    (menuOpen: boolean) =>
      setHeld((previous) => ({
        pathname,
        openDrawer: previous.pathname === pathname ? previous.openDrawer : null,
        menuOpen,
      })),
    [pathname],
  );

  const value = useMemo(
    () => ({
      openDrawer: here.openDrawer,
      setOpenDrawer,
      menuOpen: here.menuOpen,
      setMenuOpen,
    }),
    [here.openDrawer, here.menuOpen, setOpenDrawer, setMenuOpen],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  return useContext(ShellContext);
}
