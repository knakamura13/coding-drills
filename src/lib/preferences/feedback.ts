/**
 * Original answer cues. Tones are synthesized here so the public repo does not
 * ship recorded audio. `navigator.vibrate` is missing in iOS Safari, and the
 * call is skipped there.
 */

export interface Tone {
	frequency: number;
	start: number;
	duration: number;
}

export interface AnswerCue {
	vibrate: number | number[];
	tones: Tone[];
}

export function answerCue(correct: boolean): AnswerCue {
	if (correct) {
		return {
			vibrate: 12,
			tones: [
				{ frequency: 523.25, start: 0, duration: 0.09 },
				{ frequency: 659.25, start: 0.09, duration: 0.12 }
			]
		};
	}
	return {
		vibrate: [18, 36, 18],
		tones: [{ frequency: 196, start: 0, duration: 0.18 }]
	};
}

export function vibrateAnswer(correct: boolean): void {
	if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
	navigator.vibrate(answerCue(correct).vibrate);
}

export function playAnswerSound(correct: boolean): void {
	if (typeof window === 'undefined') return;
	const Ctx = window.AudioContext;
	if (typeof Ctx !== 'function') return;
	try {
		const context = new Ctx();
		void context.resume();
		const now = context.currentTime;
		for (const tone of answerCue(correct).tones) {
			const osc = context.createOscillator();
			const gain = context.createGain();
			osc.type = 'sine';
			osc.frequency.value = tone.frequency;
			gain.gain.setValueAtTime(0.0001, now + tone.start);
			gain.gain.exponentialRampToValueAtTime(0.06, now + tone.start + 0.015);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.duration);
			osc.connect(gain);
			gain.connect(context.destination);
			osc.start(now + tone.start);
			osc.stop(now + tone.start + tone.duration + 0.02);
		}
	} catch {
		// Autoplay rules or missing audio hardware leave the quiz silent.
	}
}
