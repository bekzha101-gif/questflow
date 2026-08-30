import confetti from 'canvas-confetti';

export function triggerQuestConfetti() {
  confetti({
    particleCount: 60,
    spread: 60,
    origin: { y: 0.8 },
    colors: ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'],
  });
}

export function triggerLevelUpConfetti() {
  const duration = 2.5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  const interval: ReturnType<typeof setInterval> = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
