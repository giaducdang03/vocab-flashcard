import type { MouseEvent } from 'react';

export function scrollToSection(event: MouseEvent, id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
