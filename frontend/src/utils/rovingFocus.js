// Arrow keys inside a group of option buttons (department, Tests/Panels...):
// the group is one Tab stop and Left/Right (or Up/Down) pick the neighbour.
export function rovingKeyDown(event, count, index, choose) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  const jump = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null;
  if (!step && jump === null) return;
  event.preventDefault();
  const next = jump ?? (index + step + count) % count;
  choose(next);
  const buttons = event.currentTarget.parentElement?.querySelectorAll(':scope > button, :scope > .btn');
  requestAnimationFrame(() => buttons?.[next]?.focus());
}
