export const PrimaryButton = ({ label, onClick }: { label: string; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="bg-primary text-white px-6 py-3 rounded-full font-semibold shadow-sm hover:opacity-90 transition"
  >
    {label}
  </button>
);

export const SecondaryButton = ({ label, onClick }: { label: string; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="border border-zinc-300 text-zinc-900 px-6 py-3 rounded-full font-semibold hover:border-zinc-900 transition"
  >
    {label}
  </button>
);
