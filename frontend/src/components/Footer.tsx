export default function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-hairline bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-space-sm px-margin py-space-lg text-body-sm text-muted max-sm:px-space-md md:flex-row">
        <div className="flex items-center gap-space-sm">
          <span className="text-title-sm text-ink">VocabFlash</span>
          <span>— Mindful vocabulary mastery.</span>
        </div>

        <span>© 2026 ducdang. All rights reserved.</span>
      </div>
    </footer>
  );
}
