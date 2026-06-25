export const PrimaryButton = ({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="min-h-11 w-full rounded-full bg-primary px-5 py-2.5 font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto sm:px-6 sm:py-3"
  >
    {label}
  </button>
);

export const SecondaryButton = ({ label, onClick }: { label: string; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="min-h-11 w-full rounded-full border border-zinc-300 bg-white px-5 py-2.5 font-semibold text-zinc-900 transition hover:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 sm:w-auto sm:px-6 sm:py-3"
  >
    {label}
  </button>
);
