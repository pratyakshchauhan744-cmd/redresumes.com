export const PrimaryButton = ({ label, onClick }: { label: string; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="min-h-11 w-full rounded-full bg-primary px-5 py-2.5 font-semibold text-white shadow-sm transition hover:opacity-90 sm:w-auto sm:px-6 sm:py-3"
  >
    {label}
  </button>
);

export const SecondaryButton = ({ label, onClick }: { label: string; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="min-h-11 w-full rounded-full border border-zinc-300 px-5 py-2.5 font-semibold text-zinc-900 transition hover:border-zinc-900 sm:w-auto sm:px-6 sm:py-3"
  >
    {label}
  </button>
);
