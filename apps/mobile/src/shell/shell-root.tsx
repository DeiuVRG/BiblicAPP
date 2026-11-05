import type { ReactNode } from 'react';

import { MenuDrawer } from './menu-drawer';
import { ShellProvider } from './shell-state';

/** The state of the shell and the one phone menu, mounted once above the screens. */
export function ShellRoot({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      {children}
      <MenuDrawer />
    </ShellProvider>
  );
}
