// Generated from design/tokens.json by `pnpm tokens`. Do not edit by hand.

export const NEUTRAL = {
	"void": "#040405",
	"midnight": "#08080A",
	"night": "#141517",
	"dusk": "#1E1F21",
	"twilight": "#2A2B2E",
	"shade": "#424244",
	"haze": "#68696B",
	"mist": "#A4A4A7",
	"frost": "#D7D7D9",
	"starlight": "#F1F2F4"
} as const;

export const HUE = {
	"teal": "#54DDCE",
	"amber": "#F3B957",
	"blue": "#7BBFFF",
	"lime": "#A4D76C",
	"violet": "#BAABFE",
	"orchid": "#F6A6DF",
	"rose": "#F87584"
} as const;

/** Role colors. Screens and canvas code use these, not NEUTRAL or HUE directly. */
export const ROLE = {
	"surface-page": "#08080A",
	"surface-card": "#141517",
	"surface-inset": "#040405",
	"surface-hover": "#1E1F21",
	"border-default": "#2A2B2E",
	"border-strong": "#424244",
	"text-primary": "#F1F2F4",
	"text-secondary": "#A4A4A7",
	"icon-muted": "#68696B",
	"action-primary": "#F1F2F4",
	"action-primary-pressed": "#D7D7D9",
	"action-on-primary": "#08080A",
	"focus-ring": "#F1F2F4",
	"status-missed": "#F87584",
	"feedback-wrong-border": "#7B4048",
	"scrim": "rgba(8, 8, 10, 0.7)",
	"card-edge": "rgba(255, 255, 255, 0.08)"
} as const;

/** One hue per curriculum branch, keyed by branch id. */
export const BRANCH_COLORS = {
	"foundations": "#54DDCE",
	"sequences-and-search": "#F3B957",
	"data-structures": "#7BBFFF",
	"trees-and-graphs": "#A4D76C",
	"problem-solving-patterns": "#BAABFE",
	"role-specific": "#F6A6DF"
} as const;

/** The accent set a screen gets from its branch. `none` is a screen with no branch. */
export const ACCENTS = {
	"none": {
		"base": "#F1F2F4",
		"tint": "#2F3032",
		"border": "#616264",
		"ambient": "#111113",
		"glow": "rgba(241, 242, 244, 0.5)",
		"softGlow": "rgba(241, 242, 244, 0.12)"
	},
	"foundations": {
		"base": "#54DDCE",
		"tint": "#1C2D2D",
		"border": "#2A5B57",
		"ambient": "#0B1112",
		"glow": "rgba(84, 221, 206, 0.5)",
		"softGlow": "rgba(84, 221, 206, 0.12)"
	},
	"sequences-and-search": {
		"base": "#F3B957",
		"tint": "#2F291F",
		"border": "#624E2D",
		"ambient": "#110F0D",
		"glow": "rgba(243, 185, 87, 0.5)",
		"softGlow": "rgba(243, 185, 87, 0.12)"
	},
	"data-structures": {
		"base": "#7BBFFF",
		"tint": "#202933",
		"border": "#385168",
		"ambient": "#0D0F14",
		"glow": "rgba(123, 191, 255, 0.5)",
		"softGlow": "rgba(123, 191, 255, 0.12)"
	},
	"trees-and-graphs": {
		"base": "#A4D76C",
		"tint": "#252C21",
		"border": "#465935",
		"ambient": "#0E100E",
		"glow": "rgba(164, 215, 108, 0.5)",
		"softGlow": "rgba(164, 215, 108, 0.12)"
	},
	"problem-solving-patterns": {
		"base": "#BAABFE",
		"tint": "#282733",
		"border": "#4E4A68",
		"ambient": "#0F0F14",
		"glow": "rgba(186, 171, 254, 0.5)",
		"softGlow": "rgba(186, 171, 254, 0.12)"
	},
	"role-specific": {
		"base": "#F6A6DF",
		"tint": "#2F262F",
		"border": "#63485D",
		"ambient": "#120E13",
		"glow": "rgba(246, 166, 223, 0.5)",
		"softGlow": "rgba(246, 166, 223, 0.12)"
	}
} as const;

export const TEXT = {
	"display": {
		"size": 30,
		"line": 36,
		"weight": 700,
		"tracking": -0.02,
		"desktop": {
			"size": 36,
			"line": 42
		}
	},
	"title": {
		"size": 22,
		"line": 28,
		"weight": 600,
		"tracking": -0.01,
		"desktop": {
			"size": 26,
			"line": 32
		}
	},
	"heading": {
		"size": 18,
		"line": 24,
		"weight": 600,
		"tracking": 0,
		"desktop": {
			"size": 20,
			"line": 28
		}
	},
	"body": {
		"size": 16,
		"line": 24,
		"weight": 400,
		"tracking": 0
	},
	"label": {
		"size": 14,
		"line": 20,
		"weight": 500,
		"tracking": 0
	},
	"caption": {
		"size": 12,
		"line": 16,
		"weight": 400,
		"tracking": 0
	},
	"code": {
		"size": 14,
		"line": 22,
		"weight": 400,
		"tracking": 0,
		"family": "mono"
	},
	"button": {
		"size": 16,
		"line": 20,
		"weight": 600,
		"tracking": 0
	}
} as const;

export const SPACE = {
	"1": 4,
	"2": 8,
	"3": 12,
	"4": 16,
	"5": 20,
	"6": 24,
	"7": 32,
	"8": 48,
	"screen-edge": 16,
	"card-padding": 16,
	"gap": 12
} as const;

export const RADIUS = {
	"tag": 4,
	"control": 8,
	"card": 12,
	"sheet": 16,
	"round": 9999
} as const;

export const MOTION = {
	"ease": "cubic-bezier(0.2, 0, 0, 1)",
	"duration": {
		"state": 150,
		"toast-out": 200,
		"toast-in": 250,
		"morph": 250,
		"sheet": 300,
		"caption": 400,
		"bloom": 900,
		"ripple": 1100,
		"ripple-stagger": 250,
		"toast-hold": 2600,
		"breath": 5000
	},
	"shift": {
		"full": 1,
		"reduced": 0
	},
	"fx": {
		"full": 0.5,
		"reduced": 0
	},
	"toast-distance": 16
} as const;

export const FONT = {
	"sans": "'Geist Variable', 'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
	"mono": "'Geist Mono Variable', 'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace"
} as const;
