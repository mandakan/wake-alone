/*
 * skein-audio.js - procedural, sanity-coupled atmosphere for WAKE ALONE
 *
 * Zero audio assets. Everything is synthesised at runtime with Tone.js, so the
 * site stays asset-free and the ambience can be parameterised by sanity the same
 * way the prose is. One source of truth: the renderer already knows the current
 * sanity; pipe it in here and the sound degrades with the text.
 *
 * Requires Tone.js as a global `Tone` (vendor it locally; see audio-demo.html).
 *
 * Browser autoplay policy: init() MUST be called from inside a user gesture
 * (the "begin" click). Calling it on page load is silently blocked.
 *
 * Wiring (see INTEGRATION.md):
 *   const audio = new SkeinAudio();
 *   startButton.addEventListener('click', async () => { await audio.init(); ... });
 *   audio.menu();                      // distant calm drone (salvage menu)
 *   audio.wake(); / audio.sleep();     // full ambience (play) / silence (boot)
 *   audio.blip('char'|'punct'|'boot'); // UI telemetry blips (typed tagline, boot beep)
 *   // on every navigation:
 *   audio.setSanity(state.sanity);     // 0..100
 *   audio.setNode(nodeId, node);       // retune per room, crossfaded
 *   // on a reveal / ending:
 *   audio.stinger('reveal' | 'dead' | 'sanity');
 */

(function (root, factory) {
  const SkeinAudio = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = SkeinAudio;
  if (root) root.SkeinAudio = SkeinAudio;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  // --- tuning constants (edit these to taste in the demo) ----------------
  const ROOT_HZ = 55;            // A1. Low enough to feel, high enough to render on laptops.
  const RAMP = 3.0;              // seconds for sanity-driven param changes to glide
  const NODE_RAMP = 4.0;         // seconds to crossfade tonal centre between rooms
  const MASTER_CEIL = 0.85;      // hard cap on output gain
  const MENU_LEVEL = 0.33;       // menu-scene master scale: same ship, heard from outside
  const BLIP = { charHz: 780, punctHz: 520, driftCents: 30, volDb: -18 }; // typed-tagline telemetry voice

  // A dark, mostly-minor set of roots the per-room retune can pick from, in
  // semitone offsets from ROOT_HZ. Kept narrow and low so no room sounds "nice".
  const ROOM_OFFSETS = [0, -1, 2, 3, -3, 5, -5, 6];

  const semis = (n) => Math.pow(2, n / 12);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // deterministic small hash so a given node id always retunes the same way
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }

  class SkeinAudio {
    constructor(opts = {}) {
      this.isReady = false;
      this._initing = false;      // re-entrancy guard: two gestures can race init()
      this._dread = 0;            // 0 (calm) .. 1 (gone), = (100 - sanity)/100
      this._roomSemi = 0;         // current per-room semitone offset
      this._muted = this._loadMutePref();
      this._scene = 'off';        // 'off' (boot screen) | 'menu' (distant calm drone) | 'play' (full ambience)
      this._userVolume = opts.volume != null ? opts.volume : 0.9;
      this._nodes = {};
    }

    // Build the whole graph. Idempotent; safe to await more than once.
    async init() {
      if (this.isReady || this._initing) return;
      this._initing = true;
      if (typeof Tone === 'undefined') {
        console.warn('[skein-audio] Tone.js not found on window; audio disabled.');
        this._initing = false;
        return;
      }
      try {
        // Unlock the AudioContext from the gesture. Raced against a timeout:
        // without user activation the browser leaves resume() PENDING forever
        // (it never rejects), which would wedge _initing and block every retry.
        await Promise.race([
          Tone.start(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('no user activation; context still suspended')), 3000))
        ]);
      } catch (e) {
        console.warn('[skein-audio] could not start audio context:', e);
        this._initing = false;
        return;
      }

      const n = this._nodes;

      // master -> destination, with a dark limiter so stingers can't clip
      n.limiter = new Tone.Limiter(-2).toDestination();
      n.master = new Tone.Gain(0).connect(n.limiter);

      // big, dark reverb the drone sits in; noise stays mostly dry
      n.reverb = new Tone.Reverb({ decay: 9, preDelay: 0.05, wet: 0.55 }).connect(n.master);

      // --- drone voices: root, octave, fifth, plus a dissonant partial that
      //     only fades in as dread rises (tritone above the root) ----------
      n.droneFilter = new Tone.Filter({ type: 'lowpass', frequency: 600, Q: 1.2 }).connect(n.reverb);
      n.droneGain = new Tone.Gain(0.0).connect(n.droneFilter);

      n.root = new Tone.Oscillator(ROOT_HZ, 'sine').start();
      n.octave = new Tone.Oscillator(ROOT_HZ * 2, 'sine').start();
      n.fifth = new Tone.Oscillator(ROOT_HZ * semis(7), 'triangle').start();
      n.tritone = new Tone.Oscillator(ROOT_HZ * semis(6), 'sawtooth').start();

      n.rootG = new Tone.Gain(0.5).connect(n.droneGain);
      n.octaveG = new Tone.Gain(0.18).connect(n.droneGain);
      n.fifthG = new Tone.Gain(0.22).connect(n.droneGain);
      n.tritoneG = new Tone.Gain(0.0).connect(n.droneGain); // dread-gated
      n.root.connect(n.rootG);
      n.octave.connect(n.octaveG);
      n.fifth.connect(n.fifthG);
      // tritone through its own gentle lowpass so it reads as unease, not buzz
      n.tritoneLp = new Tone.Filter({ type: 'lowpass', frequency: 380 }).connect(n.tritoneG);
      n.tritone.connect(n.tritoneLp);

      // --- sub rumble: brown-noise-driven low sine that swells at low sanity
      n.sub = new Tone.Oscillator(ROOT_HZ / 2, 'sine').start();
      n.subG = new Tone.Gain(0.0).connect(n.master); // dry, felt not heard
      n.sub.connect(n.subG);

      // --- room tone: brown noise through a low filter (hull / ventilation)
      n.noise = new Tone.Noise('brown').start();
      n.noiseFilter = new Tone.Filter({ type: 'lowpass', frequency: 500, Q: 0.7 }).connect(n.master);
      n.noiseGain = new Tone.Gain(0.0).connect(n.noiseFilter);
      n.noise.connect(n.noiseGain);

      // --- slow movement: an LFO breathing the drone filter open and shut.
      //     Rate slows and depth widens with dread, so calm = gentle sway,
      //     gone = long lurching wobble.
      n.lfo = new Tone.LFO({ frequency: 0.06, min: 380, max: 760 }).start();
      n.lfo.connect(n.droneFilter.frequency);

      // a second, very slow detune wobble on the fifth for living beats
      n.detuneLfo = new Tone.LFO({ frequency: 0.018, min: -4, max: 4 }).start();
      n.detuneLfo.connect(n.fifth.detune);

      this.isReady = true;
      this._initing = false;

      // fade in to the current state
      this._applyMaster(0.0);
      this._applyDread(RAMP);
      this._applyMaster(RAMP);
    }

    // sanity: 0..100 from the engine. Higher sanity = calmer.
    setSanity(sanity) {
      const s = clamp(Number(sanity), 0, 100);
      this._dread = (100 - s) / 100;
      if (this.isReady) this._applyDread(RAMP);
    }

    // retune the tonal centre per room so spaces feel distinct; crossfaded.
    // node arg is optional (the node object); only the id is needed.
    setNode(nodeId, node) {
      if (!nodeId) return;
      const off = ROOM_OFFSETS[hashStr(String(nodeId)) % ROOM_OFFSETS.length];
      this._roomSemi = off;
      if (!this.isReady) return;
      const r = ROOT_HZ * semis(off);
      const t = NODE_RAMP;
      this._nodes.root.frequency.rampTo(r, t);
      this._nodes.octave.frequency.rampTo(r * 2, t);
      this._nodes.fifth.frequency.rampTo(r * semis(7), t);
      this._nodes.tritone.frequency.rampTo(r * semis(6), t);
      this._nodes.sub.frequency.rampTo(r / 2, t);
    }

    // one-shot synthesised hits. No samples. Self-disposing.
    stinger(kind = 'reveal') {
      if (!this.isReady) return;
      const now = Tone.now();
      try {
        if (kind === 'dead' || kind === 'death') {
          const m = new Tone.MembraneSynth({
            pitchDecay: 0.12, octaves: 6,
            envelope: { attack: 0.001, decay: 0.9, sustain: 0.0, release: 1.4 }
          }).connect(this._nodes.reverb);
          m.volume.value = -6;
          m.triggerAttackRelease('C1', '2n', now);
          const swell = new Tone.NoiseSynth({
            noise: { type: 'brown' },
            envelope: { attack: 0.6, decay: 1.2, sustain: 0 }
          }).connect(this._nodes.reverb);
          swell.volume.value = -16;
          swell.triggerAttackRelease('1n', now);
          this._disposeLater([m, swell], 4000);
        } else if (kind === 'sanity') {
          // brief dissonant cluster: root + minor second, plucked, decaying
          const a = new Tone.FMSynth({ harmonicity: 1.01, modulationIndex: 7,
            envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.6 } }).connect(this._nodes.reverb);
          a.volume.value = -14;
          a.triggerAttackRelease('A3', '4n', now);
          a.triggerAttackRelease('A#3', '4n', now + 0.01);
          this._disposeLater([a], 2500);
        } else { // 'reveal'
          const metal = new Tone.MetalSynth({
            envelope: { attack: 0.001, decay: 0.7, release: 0.3 },
            harmonicity: 4.1, modulationIndex: 18, resonance: 1200, octaves: 1.2
          }).connect(this._nodes.reverb);
          metal.volume.value = -22;
          metal.triggerAttackRelease('16n', now);
          this._disposeLater([metal], 3000);
        }
      } catch (e) {
        console.warn('[skein-audio] stinger failed:', e);
      }
    }

    // UI voice for the boot beep and the typed-tagline telemetry blips. Bypasses
    // the scene gate (it must sound on the boot screen, where the drone is still
    // silent) but respects mute and the volume pref. One mono synth, lazily built.
    blip(kind = 'char') {
      if (!this.isReady || this._muted) return;
      const n = this._nodes;
      try {
        if (!n.blipSynth) {
          n.blipLp = new Tone.Filter({ type: 'lowpass', frequency: 1400, Q: 0.5 }).connect(n.limiter);
          n.blipSynth = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.004, decay: 0.028, sustain: 0, release: 0.012 },
            volume: BLIP.volDb
          }).connect(n.blipLp);
        }
        const now = Tone.now(), v = this._userVolume;
        if (kind === 'boot') { // the audio bus coming up: two slower notes
          n.blipSynth.triggerAttackRelease(BLIP.punctHz, 0.09, now, 0.9 * v);
          n.blipSynth.triggerAttackRelease(BLIP.charHz, 0.07, now + 0.13, 0.7 * v);
        } else {
          const hz = (kind === 'punct' ? BLIP.punctHz : BLIP.charHz)
            * Math.pow(2, (Math.random() * 2 - 1) * BLIP.driftCents / 1200);
          n.blipSynth.triggerAttackRelease(hz, 0.03, now, 0.5 * v);
        }
      } catch (e) { /* a UI sound must never break the UI */ }
    }

    // scene gate, orthogonal to mute: sleep() on the boot screen, menu() on the
    // salvage menu (distant, dread clamped calm), wake() entering play.
    wake() { this._setScene('play'); }
    menu() { this._setScene('menu'); }
    sleep() { this._setScene('off'); }
    _setScene(s) {
      this._scene = s;
      if (!this.isReady) return;
      this._applyDread(RAMP); // menu clamps dread to calm; play restores it
      this._applyMaster(s === 'off' ? 2.0 : RAMP);
    }

    setVolume(v) { this._userVolume = clamp(Number(v), 0, 1); if (this.isReady) this._applyMaster(0.3); }
    mute() { this._muted = true; this._saveMutePref(); if (this.isReady) this._applyMaster(0.5); }
    unmute() { this._muted = false; this._saveMutePref(); if (this.isReady) this._applyMaster(0.5); }
    toggle() { this._muted ? this.unmute() : this.mute(); return !this._muted; }
    get muted() { return this._muted; }

    dispose() {
      if (!this.isReady) return;
      Object.values(this._nodes).forEach((x) => { try { x.dispose && x.dispose(); } catch (_) {} });
      this._nodes = {};
      this.isReady = false;
    }

    // --- internals ---------------------------------------------------------

    _applyMaster(time) {
      const scene = this._scene === 'play' ? 1 : (this._scene === 'menu' ? MENU_LEVEL : 0);
      const target = this._muted ? 0 : this._userVolume * MASTER_CEIL * scene;
      this._nodes.master.gain.rampTo(target, time);
    }

    // map dread (0..1) onto every voice. All ramped so it never steps.
    _applyDread(time) {
      // the menu holds calm regardless of the last episode's sanity
      const d = this._scene === 'menu' ? 0 : this._dread, n = this._nodes;

      // drone present at all times, a touch louder as dread rises
      n.droneGain.gain.rampTo(lerp(0.45, 0.62, d), time);

      // beating: spread detune across the voices as it falls apart
      const cents = lerp(2, 28, d);
      n.root.detune.rampTo(-cents * 0.5, time);
      n.octave.detune.rampTo(cents * 0.7, time);
      // (fifth detune is owned by detuneLfo; widen its swing instead)
      n.detuneLfo.min = -lerp(3, 12, d);
      n.detuneLfo.max = lerp(3, 12, d);

      // the tritone partial: silent when calm, an audible wrongness past ~half
      n.tritoneG.gain.rampTo(d < 0.45 ? 0 : lerp(0, 0.16, (d - 0.45) / 0.55), time);

      // room tone rises; filter closes in (muffled, pressing) as dread climbs
      n.noiseGain.gain.rampTo(lerp(0.015, 0.085, d), time);
      n.noiseFilter.frequency.rampTo(lerp(620, 240, d), time);

      // sub rumble swells only in the last third
      n.subG.gain.rampTo(d < 0.6 ? 0 : lerp(0, 0.12, (d - 0.6) / 0.4), time);

      // LFO: slows and deepens — gentle sway -> long lurch
      n.lfo.frequency.rampTo(lerp(0.06, 0.02, d), time);
      n.lfo.min = lerp(400, 200, d);
      n.lfo.max = lerp(760, 520, d);
    }

    _disposeLater(arr, ms) { setTimeout(() => arr.forEach((x) => { try { x.dispose(); } catch (_) {} }), ms); }

    _loadMutePref() {
      try { return localStorage.getItem('skein-audio-muted') === '1'; } catch (_) { return false; }
    }
    _saveMutePref() {
      try { localStorage.setItem('skein-audio-muted', this._muted ? '1' : '0'); } catch (_) {}
    }
  }

  return SkeinAudio;
});
