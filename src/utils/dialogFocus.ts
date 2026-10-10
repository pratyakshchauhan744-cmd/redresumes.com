export function getFocusTrapTarget<T>(
  focusable: readonly T[],
  activeElement: T | null,
  shiftKey: boolean
): T | null {
  if (focusable.length === 0) return null;
  const first = focusable[0] as T;
  const last = focusable[focusable.length - 1] as T;
  if (shiftKey && activeElement === first) return last;
  if (!shiftKey && activeElement === last) return first;
  return null;
}

export function shouldCloseDialogOnEscape(key: string, closeDisabled: boolean): boolean {
  return key === "Escape" && !closeDisabled;
}
