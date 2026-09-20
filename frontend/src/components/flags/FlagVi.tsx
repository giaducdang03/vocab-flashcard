/** Cờ Việt Nam. Kích thước do className quyết định. */
export default function FlagVi({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true" focusable="false">
      <rect width="30" height="20" fill="#DA251D" />
      <path
        fill="#FF0"
        d="M15 4.4l1.47 4.53h4.76l-3.85 2.8 1.47 4.53L15 13.46l-3.85 2.8 1.47-4.53-3.85-2.8h4.76z"
      />
    </svg>
  );
}
