/**
 * Procedural Web Audio API Flight Sound Engine
 * Generates continuous adaptive turbine/wind soundscapes and discrete tactical audio cues.
 */

class FlightSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isRunning: boolean = false;

  // Continuous flight nodes
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Wind rush noise
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  public init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.32;
      this.masterGain.connect(this.ctx.destination);

      // Turbine Oscillator 1 (Sawtooth core)
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.value = 65;

      // Turbine Oscillator 2 (Triangle harmonic)
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.value = 130;

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 240;
      this.engineFilter.Q.value = 2.5;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.001;

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc1.start();
      this.engineOsc2.start();

      // Procedural Pink/White Wind Noise Buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      this.windSource = this.ctx.createBufferSource();
      this.windSource.buffer = noiseBuffer;
      this.windSource.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 400;
      this.windFilter.Q.value = 1.2;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.001;

      this.windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      this.windSource.start();

      this.isRunning = true;
    } catch {
      // AudioContext blocked or unsupported
    }
  }

  public updateFlightAudio(
    active: boolean,
    speedKmh: number,
    throttlePct: number,
    altitudeM: number,
    isBoosting: boolean
  ) {
    if (!this.ctx || !this.isRunning || !this.engineGain || !this.windGain || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.windFilter) {
      return;
    }

    const now = this.ctx.currentTime;
    if (!active || this.isMuted) {
      this.engineGain.gain.setTargetAtTime(0.0001, now, 0.08);
      this.windGain.gain.setTargetAtTime(0.0001, now, 0.08);
      return;
    }

    const normSpeed = Math.min(Math.max(speedKmh / 450, 0), 1.2);
    const normThrottle = Math.min(Math.max(throttlePct / 100, 0), 1);

    // Pitch and harmonic modulation
    const baseFreq = 52 + normThrottle * 68 + normSpeed * 45 + (isBoosting ? 28 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.05);

    const filterCutoff = 180 + normThrottle * 420 + normSpeed * 350 + (isBoosting ? 350 : 0);
    this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.06);

    const engineVol = 0.08 + normThrottle * 0.14 + (isBoosting ? 0.06 : 0);
    this.engineGain.gain.setTargetAtTime(engineVol, now, 0.06);

    // Wind rush adapts to speed and ground proximity
    const lowAltFactor = Math.max(0, 1 - altitudeM / 120);
    const windFreq = 280 + normSpeed * 820 + lowAltFactor * 260;
    this.windFilter.frequency.setTargetAtTime(windFreq, now, 0.06);

    const windVol = Math.min(0.28, 0.03 + normSpeed * 0.16 + lowAltFactor * 0.07);
    this.windGain.gain.setTargetAtTime(windVol, now, 0.06);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.32, this.ctx.currentTime, 0.04);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playRingCollect(combo: number = 1) {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    const baseNote = 523.25 * Math.pow(1.06, Math.min(combo, 12)); // C5 scaling up
    osc.frequency.setValueAtTime(baseNote, now);
    osc.frequency.exponentialRampToValueAtTime(baseNote * 1.5, now + 0.16);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playLevelUp() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const notes = [440, 554.37, 659.25, 880]; // A4 major arpeggio
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.36);
    });
  }

  public playCollision(heavy: boolean = false) {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(heavy ? 110 : 160, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + (heavy ? 0.35 : 0.2));

    gain.gain.setValueAtTime(heavy ? 0.45 : 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.38 : 0.22));

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playInviteAlert() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const freqs = [587.33, 880];
    freqs.forEach((f, i) => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime + i * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.24);
    });
  }

  public playUiClick() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.045);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }
}

export const soundEngine = new FlightSoundEngine();
