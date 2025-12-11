
// services/soundService.ts

// Create audio context lazily to comply with browser autoplay policies
let audioContext: AudioContext | null = null;

const getContext = () => {
    try {
        // If context exists but is closed (e.g. device sleep or resource reclaim), discard it
        if (audioContext && audioContext.state === 'closed') {
            audioContext = null;
        }

        if (!audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                audioContext = new AudioContextClass();
            }
        }
        return audioContext;
    } catch (e) {
        console.warn("AudioContext not supported or blocked", e);
        return null;
    }
};

const playTone = (freq: number, type: OscillatorType, duration: number, startTime: number = 0, vol: number = 0.1) => {
    try {
        const ctx = getContext();
        if (!ctx) return;
        
        // Try to resume if suspended, but don't await/block main thread significantly
        if(ctx.state === 'suspended') {
            ctx.resume().catch(e => console.warn("Could not resume audio context", e));
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        
        gain.gain.setValueAtTime(vol, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
    } catch (e) {
        // Silently fail if audio plays error to avoid crashing the app
        console.warn("Sound playback failed", e);
    }
};

export const playClick = () => {
    // Short, high-pitched blip for UI interaction
    playTone(800, 'sine', 0.05, 0, 0.05);
};

export const playToggle = () => {
    // Sharp, mechanical "tick"
    playTone(1200, 'square', 0.05, 0, 0.03);
};

export const playSuccess = () => {
    // Ascending arpeggio for achievements/completion
    const now = 0;
    playTone(440, 'sine', 0.2, now, 0.1);       // A4
    playTone(554.37, 'sine', 0.2, now + 0.1, 0.1); // C#5
    playTone(659.25, 'sine', 0.4, now + 0.2, 0.1); // E5
};

export const playError = () => {
    // Low, descending buzz
    playTone(150, 'sawtooth', 0.3, 0, 0.05);
    playTone(100, 'sawtooth', 0.3, 0.1, 0.05);
};

export const playNotification = () => {
    // Soft double chime
    playTone(1200, 'sine', 0.3, 0, 0.05);
    playTone(1200, 'sine', 0.3, 0.15, 0.05);
};

export const playMessageSent = () => {
    // Quick data burst sound
    const now = 0;
    playTone(800, 'square', 0.03, now, 0.02);
    playTone(1200, 'square', 0.03, now + 0.04, 0.02);
};

export const playMessageReceived = () => {
    // Soft incoming transmission chime
    const now = 0;
    playTone(600, 'sine', 0.1, now, 0.05);
    playTone(900, 'sine', 0.3, now + 0.05, 0.05);
};

export const playModalOpen = () => {
    // A sweeping sound
    const now = 0;
    playTone(200, 'sine', 0.1, now, 0.05);
    playTone(400, 'sine', 0.1, now + 0.05, 0.05);
    playTone(600, 'sine', 0.2, now + 0.1, 0.03);
};

export const playHover = () => {
    // Very subtle, short tick for hover to give a tactile feel
    const ctx = getContext();
    if (!ctx) return;

    // Check state but don't force resume on hover to avoid console spam if not interacted yet
    if(ctx.state === 'running') { 
        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(2000, now);
            gain.gain.setValueAtTime(0.02, now); 
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.01);
        } catch(e) {}
    }
};

export const playLogin = () => {
    // Power up sweep
    try {
        const ctx = getContext();
        if (!ctx) return;
        if(ctx.state === 'suspended') ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.4);
        
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.4);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
    } catch(e) {}
};

export const playLogout = () => {
    // Power down sweep
    try {
        const ctx = getContext();
        if (!ctx) return;
        if(ctx.state === 'suspended') ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.4);
        
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.4);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
    } catch(e) {}
};

export const playDelete = () => {
    // Crunch/Trash sound
    const now = 0;
    playTone(150, 'sawtooth', 0.1, now, 0.1);
    playTone(50, 'sawtooth', 0.2, now + 0.1, 0.1);
};

export const playTabSwitch = () => {
    // Futuristic "swish" for tab changes
    try {
        const ctx = getContext();
        if (!ctx) return;
        if(ctx.state === 'suspended') ctx.resume().catch(() => {});
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        
        // Slide pitch up
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
        
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    } catch(e) {}
};

export const playAlert = () => {
    const now = 0;
    playTone(440, 'sawtooth', 0.4, now, 0.1); 
    playTone(622.25, 'sawtooth', 0.4, now, 0.1); 
};

export const playLevelUp = () => {
    // Major arpeggio power-up
    const now = 0;
    playTone(523.25, 'square', 0.2, now, 0.05);
    playTone(659.25, 'square', 0.2, now + 0.08, 0.05);
    playTone(783.99, 'square', 0.2, now + 0.16, 0.05);
    playTone(1046.50, 'square', 0.4, now + 0.24, 0.05);
};

export const playProcess = () => {
    try {
        const ctx = getContext();
        if (!ctx) return;
        if(ctx.state === 'suspended') ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        gain.connect(ctx.destination);

        for(let i=0; i<10; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(200 + Math.random()*500, now + i*0.05);
            osc.connect(gain);
            osc.start(now + i*0.05);
            osc.stop(now + i*0.05 + 0.03);
        }
    } catch(e) {}
};

export const playUpload = () => {
    const now = 0;
    playTone(200, 'sawtooth', 0.3, now, 0.05);
};

// Improved Retro Keystroke - Quieter and Shorter for Typing
let keyClickBuffer: AudioBuffer | null = null;

export const playRetroKeystroke = () => {
    try {
        const ctx = getContext();
        if (!ctx) return;
        if(ctx.state === 'suspended') ctx.resume().catch(() => {});
        
        // Create buffer once
        if (!keyClickBuffer) {
            const bufferSize = ctx.sampleRate * 0.05; // 50ms buffer
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                // White noise
                data[i] = Math.random() * 2 - 1;
            }
            keyClickBuffer = buffer;
        }

        const now = ctx.currentTime;

        // 1. The "Click" (Filtered Noise) - Shorter envelope, lower volume
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = keyClickBuffer;
        
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1200; // Higher pitch to sound crisper/smaller

        const noiseGain = ctx.createGain();
        // Much Lower volume for background effect
        noiseGain.gain.setValueAtTime(0.015, now); 
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02); // Very short decay (20ms)

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        
        noiseSource.start(now);

        // 2. The "Thud" (Low Sine) - almost imperceptible body
        const thudOsc = ctx.createOscillator();
        thudOsc.type = 'sine';
        thudOsc.frequency.setValueAtTime(200, now);
        thudOsc.frequency.exponentialRampToValueAtTime(100, now + 0.03);

        const thudGain = ctx.createGain();
        thudGain.gain.setValueAtTime(0.02, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        thudOsc.connect(thudGain);
        thudGain.connect(ctx.destination);
        
        thudOsc.start(now);
        thudOsc.stop(now + 0.03);
    } catch(e) {}
};
