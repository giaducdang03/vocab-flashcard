/** Cờ Anh (Union Jack). Kích thước do className quyết định. */
export default function FlagEn({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 42" className={className} aria-hidden="true" focusable="false">
      <rect width="60" height="42" fill="#012169" />
      <path d="M0 0l60 42M60 0L0 42" stroke="#fff" strokeWidth="8" />
      <path d="M0 0l60 42M60 0L0 42" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v42M0 21h60" stroke="#fff" strokeWidth="14" />
      <path d="M30 0v42M0 21h60" stroke="#C8102E" strokeWidth="8" />
    </svg>
  );
}
