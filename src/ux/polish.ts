/**
 * UX Polish Module
 *
 * Provides interactive setup wizard, model autocomplete,
 * human-readable cron schedules, progress streaming,
 * typing indicators, actionable error messages, and i18n.
 */

import type {
	ModelSuggestion,
	ProgressUpdate,
	SetupWizardStep,
	UXConfig,
} from "./types.js";

// ── Model Database ───────────────────────────────────────────────────────────

const MODEL_DATABASE: Record<string, ModelSuggestion[]> = {
	openai: [
		{
			name: "gpt-4o",
			provider: "openai",
			description: "Latest flagship model",
			recommended: true,
		},
		{
			name: "gpt-4o-mini",
			provider: "openai",
			description: "Fast and efficient",
			recommended: false,
		},
		{
			name: "gpt-4-turbo",
			provider: "openai",
			description: "Turbo variant",
			recommended: false,
		},
		{
			name: "gpt-3.5-turbo",
			provider: "openai",
			description: "Cost-effective",
			recommended: false,
		},
		{
			name: "o1",
			provider: "openai",
			description: "Reasoning model",
			recommended: false,
		},
		{
			name: "o3",
			provider: "openai",
			description: "Advanced reasoning",
			recommended: false,
		},
	],
	anthropic: [
		{
			name: "claude-sonnet-4-20250514",
			provider: "anthropic",
			description: "Latest Sonnet",
			recommended: true,
		},
		{
			name: "claude-opus-4-20250514",
			provider: "anthropic",
			description: "Most capable",
			recommended: false,
		},
		{
			name: "claude-haiku-3-5-20241022",
			provider: "anthropic",
			description: "Fast and efficient",
			recommended: false,
		},
	],
	ollama: [
		{
			name: "llama3.1",
			provider: "ollama",
			description: "Meta Llama 3.1",
			recommended: true,
		},
		{
			name: "mistral",
			provider: "ollama",
			description: "Mistral 7B",
			recommended: false,
		},
		{
			name: "codellama",
			provider: "ollama",
			description: "Code-focused",
			recommended: false,
		},
		{
			name: "phi3",
			provider: "ollama",
			description: "Microsoft Phi-3",
			recommended: false,
		},
	],
};

// ── Translations ─────────────────────────────────────────────────────────────

const TRANSLATIONS: Record<string, Record<string, string>> = {
	greeting: {
		en: "Hello! How can I help you?",
		zh: "你好！有什么我可以帮你的吗？",
		es: "¡Hola! ¿Cómo puedo ayudarte?",
		fr: "Bonjour ! Comment puis-je vous aider ?",
		ja: "こんにちは！どうお手伝いしましょうか？",
	},
	farewell: {
		en: "Goodbye! Have a great day!",
		zh: "再见！祝你有美好的一天！",
		es: "¡Adiós! ¡Que tengas un gran día!",
		fr: "Au revoir ! Passez une excellente journée !",
		ja: "さようなら！良い一日を！",
	},
	processing: {
		en: "Processing your request...",
		zh: "正在处理您的请求...",
		es: "Procesando su solicitud...",
		fr: "Traitement de votre demande...",
		ja: "リクエストを処理しています...",
	},
};

// ── Error Suggestions ────────────────────────────────────────────────────────

const ERROR_SUGGESTIONS: Record<
	string,
	{ message: string; suggestion: string }
> = {
	api_key_missing: {
		message: "API key is not configured.",
		suggestion:
			"Run `synthtek config set api_key <your-key>` or set the SYNTHTEK_API_KEY environment variable.",
	},
	connection_failed: {
		message: "Failed to connect to the provider.",
		suggestion:
			"Check your network connection and verify the provider URL is correct.",
	},
	rate_limited: {
		message: "Rate limit exceeded.",
		suggestion:
			"Wait a moment before retrying, or increase your rate limit in the provider settings.",
	},
	invalid_model: {
		message: "The specified model is not available.",
		suggestion: "Use `synthtek models list` to see available models.",
	},
	timeout: {
		message: "Request timed out.",
		suggestion: "Try increasing the timeout setting or use a faster model.",
	},
};

export class UXPolish {
	private readonly _config: UXConfig;

	constructor(config: UXConfig) {
		this._config = config;
	}

	// ── Interactive Setup Wizard ───────────────────────────────────────────────

	getWizardSteps(): SetupWizardStep[] {
		return [
			{
				id: "welcome",
				title: "Welcome to Synthtek",
				description: "Let's set up your AI agent in a few simple steps.",
				required: true,
			},
			{
				id: "provider",
				title: "Select Provider",
				description:
					"Choose your AI provider (OpenAI, Anthropic, Ollama, etc.)",
				required: true,
			},
			{
				id: "model",
				title: "Select Model",
				description: "Choose the model you want to use.",
				required: true,
			},
			{
				id: "api-key",
				title: "Configure API Key",
				description: "Enter your API key for the selected provider.",
				required: true,
			},
			{
				id: "channel",
				title: "Select Channel",
				description:
					"Choose how you want to interact (CLI, Telegram, Discord, etc.)",
				required: false,
			},
			{
				id: "complete",
				title: "Setup Complete",
				description: "Your agent is ready to use!",
				required: false,
			},
		];
	}

	advanceStep(current: number): number {
		const steps = this.getWizardSteps();
		return Math.min(current + 1, steps.length - 1);
	}

	// ── Model Autocomplete ─────────────────────────────────────────────────────

	suggestModels(provider: string, query?: string): ModelSuggestion[] {
		const models = MODEL_DATABASE[provider.toLowerCase()];
		if (!models) return [];

		if (query) {
			return models.filter((m) =>
				m.name.toLowerCase().includes(query.toLowerCase()),
			);
		}

		return models;
	}

	// ── Human-Readable Cron Schedules ──────────────────────────────────────────

	formatCronSchedule(expr: string): string {
		const parts = expr.trim().split(/\s+/);
		if (parts.length !== 5) {
			return "Invalid cron expression";
		}

		const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

		// Weekly (specific day of week)
		if (dayOfWeek !== "*" && dayOfMonth === "*" && month === "*") {
			const days = [
				"Sunday",
				"Monday",
				"Tuesday",
				"Wednesday",
				"Thursday",
				"Friday",
				"Saturday",
			];
			const dayIndex = parseInt(dayOfWeek, 10);
			if (!Number.isNaN(dayIndex) && dayIndex >= 0 && dayIndex <= 6) {
				return `Every ${days[dayIndex]} at ${parseInt(hour, 10)}:${minute.padStart(2, "0")}`;
			}
		}

		// Monthly (specific day of month)
		if (dayOfMonth !== "*" && dayOfWeek === "*" && month === "*") {
			const dayNum = parseInt(dayOfMonth, 10);
			if (!Number.isNaN(dayNum)) {
				const suffix = this.getOrdinalSuffix(dayNum);
				return `Every month on the ${dayNum}${suffix} at ${parseInt(hour, 10)}:${minute.padStart(2, "0")}`;
			}
		}

		// Daily
		if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
			return `Daily at ${parseInt(hour, 10)}:${minute.padStart(2, "0")}`;
		}

		// Hourly
		if (
			minute !== "*" &&
			hour === "*" &&
			dayOfMonth === "*" &&
			month === "*" &&
			dayOfWeek === "*"
		) {
			return `Every hour at minute ${minute}`;
		}

		// Every N minutes
		if (
			hour === "*" &&
			dayOfMonth === "*" &&
			month === "*" &&
			dayOfWeek === "*"
		) {
			return `Every hour at minute ${minute}`;
		}

		return `Cron: ${expr}`;
	}

	private getOrdinalSuffix(n: number): string {
		if (n >= 11 && n <= 13) return "th";
		switch (n % 10) {
			case 1:
				return "st";
			case 2:
				return "nd";
			case 3:
				return "rd";
			default:
				return "th";
		}
	}

	// ── Progress Streaming ─────────────────────────────────────────────────────

	createProgressUpdate(
		task: string,
		current: number,
		total: number,
	): ProgressUpdate {
		return {
			task,
			current,
			total,
			percentage: this.calculateProgress(current, total),
			timestamp: Date.now(),
		};
	}

	calculateProgress(current: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((current / total) * 100);
	}

	generateProgressBar(
		current: number,
		total: number,
		width: number = 20,
	): string {
		const percent = this.calculateProgress(current, total);
		const filled = Math.round((percent / 100) * width);
		const empty = width - filled;

		return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${percent}%`;
	}

	// ── Typing Indicators ──────────────────────────────────────────────────────

	generateTypingIndicator(): string {
		if (!this._config.showTypingIndicator) return "";
		return "Thinking...";
	}

	// ── Error Messages with Actionable Suggestions ─────────────────────────────

	formatError(code: string): string {
		const error = ERROR_SUGGESTIONS[code];
		if (error) {
			return `${error.message} ${error.suggestion}`;
		}
		return "An unexpected error occurred. Please check the logs for more details.";
	}

	// ── Multi-Language Support (i18n) ──────────────────────────────────────────

	translate(key: string, language: string): string {
		const langTranslations = TRANSLATIONS[key];
		if (!langTranslations) {
			return key;
		}

		return langTranslations[language] ?? langTranslations.en ?? key;
	}
}
