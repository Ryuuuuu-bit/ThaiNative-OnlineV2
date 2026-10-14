export function startLoop(update, render) {
  let previous = performance.now(),
    id = 0,
    stopped = false;
  function tick(now) {
    if (stopped) return;
    const elapsed = (now - previous) / 1000,
      dt = Math.min(elapsed, 0.05);
    previous = now;
    update(dt, now / 1000, elapsed);
    render(dt);
    id = requestAnimationFrame(tick);
  }
  id = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(id);
  };
}
