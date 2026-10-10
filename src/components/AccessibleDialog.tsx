import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getFocusTrapTarget, shouldCloseDialogOnEscape } from "../utils/dialogFocus";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export interface AccessibleDialogProps {
  children: ReactNode;
  titleId: string;
  descriptionId?: string;
  onClose: () => void;
  closeDisabled?: boolean;
  className: string;
  overlayClassName?: string;
}

export function AccessibleDialog({
  children,
  titleId,
  descriptionId,
  onClose,
  closeDisabled = false,
  className,
  overlayClassName = "items-center justify-center p-4",
}: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const appRoot = document.getElementById("root");
    const wasInert = appRoot?.inert ?? false;
    if (appRoot) appRoot.inert = true;

    const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
    const initialFocus = dialog.querySelector<HTMLElement>("[data-dialog-autofocus]") ?? focusable[0] ?? dialog;
    const focusFrame = requestAnimationFrame(() => initialFocus.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldCloseDialogOnEscape(event.key, closeDisabledRef.current)) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const activeFocusable = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
      if (activeFocusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const target = getFocusTrapTarget<HTMLElement>(
        activeFocusable,
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
        event.shiftKey
      );
      if (target) {
        event.preventDefault();
        target.focus();
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      if (appRoot) appRoot.inert = wasInert;
      restoreFocusRef.current?.focus();
    };
  }, []);

  return createPortal(
    <div className={`fixed inset-0 z-50 flex bg-black/80 backdrop-blur-sm ${overlayClassName}`}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={`min-w-0 ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
