// Double bip de notification par Web Audio — aucun fichier son à télécharger.
// Respecte le réglage « notifications_sonores » côté appelant.

export function playMessageNotification(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const beep = (start: number, freq: number): void => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.22, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + 0.24);
    };

    beep(0, 880);
    beep(0.18, 1244);

    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 900);
  } catch {
    /* le son ne doit jamais faire planter l'app (policy autoplay, etc.) */
  }
}
