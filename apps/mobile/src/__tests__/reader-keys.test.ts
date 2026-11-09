import { inEditableField, readerKeyAction } from '@/features/reader/reader-keys';

describe('readerKeyAction (docs/ui-spec-v2.md, 8.13)', () => {
  it('moves between chapters with the arrows and toggles the outline with the brackets', () => {
    expect(readerKeyAction({ key: 'ArrowLeft' }, false)).toBe('previous');
    expect(readerKeyAction({ key: 'ArrowRight' }, false)).toBe('next');
    expect(readerKeyAction({ key: '[' }, false)).toBe('outline');
    expect(readerKeyAction({ key: ']' }, false)).toBe('outline');
  });

  it('ignores the arrows, the brackets and the slash while the focus is in a field', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', '[', ']', '/']) {
      expect(readerKeyAction({ key }, true)).toBeNull();
    }
  });

  it('opens find with /, Ctrl+K, Cmd+K and Ctrl or Cmd+Shift+F', () => {
    expect(readerKeyAction({ key: '/' }, false)).toBe('find');
    expect(readerKeyAction({ key: 'k', ctrlKey: true }, false)).toBe('find');
    expect(readerKeyAction({ key: 'K', metaKey: true }, false)).toBe('find');
    expect(readerKeyAction({ key: 'F', ctrlKey: true, shiftKey: true }, false)).toBe('find');
    expect(readerKeyAction({ key: 'f', metaKey: true, shiftKey: true }, true)).toBe('find');
    // Ctrl+F is the browser's own search: not taken.
    expect(readerKeyAction({ key: 'f', ctrlKey: true }, false)).toBeNull();
  });

  it('opens Ask with Ctrl or Cmd+Shift+A', () => {
    expect(readerKeyAction({ key: 'A', ctrlKey: true, shiftKey: true }, false)).toBe('ask');
    expect(readerKeyAction({ key: 'a', metaKey: true }, false)).toBeNull();
  });

  it('takes Escape anywhere, in a field too', () => {
    expect(readerKeyAction({ key: 'Escape' }, true)).toBe('escape');
    expect(readerKeyAction({ key: 'Escape' }, false)).toBe('escape');
  });

  it('leaves every other key, and the keys with Alt, to the browser', () => {
    expect(readerKeyAction({ key: 'x' }, false)).toBeNull();
    expect(readerKeyAction({ key: 'ArrowRight', altKey: true }, false)).toBeNull();
    expect(readerKeyAction({ key: 'Enter' }, false)).toBeNull();
  });
});

describe('inEditableField', () => {
  it('knows inputs, text areas, selects and editable elements', () => {
    expect(inEditableField({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(inEditableField({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(
      inEditableField({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget),
    ).toBe(true);
    expect(inEditableField({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false);
    expect(inEditableField(null)).toBe(false);
  });
});
