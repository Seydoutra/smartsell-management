let audioContext: AudioContext | null = null;

/** Retour sonore/haptique court déclenché uniquement depuis une interaction utilisateur. */
export function playUiTone(kind: 'tap' | 'confirm' = 'tap') {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(kind === 'confirm' ? 640 : 440, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'confirm' ? 820 : 520, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.09);
  } catch {
    // Certains navigateurs bloquent Web Audio ou l’environnement n’a pas de sortie audio.
  }
  try {
    if ('vibrate' in navigator) navigator.vibrate(kind === 'confirm' ? [8, 18, 8] : 8);
  } catch {
    // Vibration facultative, sans impact sur la navigation.
  }
}
