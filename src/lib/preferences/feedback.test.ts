import { describe, expect, it } from 'vitest';
import { answerCue, playAnswerSound, vibrateAnswer } from './feedback';

describe('answer cues', () => {
	it('uses a different short cue for a right answer and a wrong one', () => {
		const right = answerCue(true);
		const wrong = answerCue(false);
		expect(right.vibrate).not.toEqual(wrong.vibrate);
		expect(right.tones.map((tone) => tone.frequency)).not.toEqual(wrong.tones.map((tone) => tone.frequency));
		for (const cue of [right, wrong]) {
			expect(cue.tones.length).toBeGreaterThan(0);
			for (const tone of cue.tones) expect(tone.duration).toBeLessThan(0.3);
		}
	});

	it('does nothing where audio or vibration is unavailable', () => {
		expect(() => playAnswerSound(true)).not.toThrow();
		expect(() => vibrateAnswer(false)).not.toThrow();
	});
});
