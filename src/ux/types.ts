/**
 * UX Polish Types
 */

export interface UXConfig {
	language: string;
	theme: "dark" | "light";
	showTypingIndicator: boolean;
	maxProgressSteps: number;
}

export interface SetupWizardStep {
	id: string;
	title: string;
	description: string;
	required: boolean;
}

export interface ModelSuggestion {
	name: string;
	provider: string;
	description: string;
	recommended: boolean;
}

export interface ProgressUpdate {
	task: string;
	current: number;
	total: number;
	percentage: number;
	timestamp: number;
}

export interface ErrorSuggestion {
	code: string;
	message: string;
	suggestion: string;
}

export interface Translation {
	key: string;
	language: string;
	text: string;
}
