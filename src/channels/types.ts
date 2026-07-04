/**
 * Shared channel types for synthtek
 */

/** Shared stream buffer for channel streaming output */
export interface StreamBuffer<TMessageId = string | number> {
	text: string;
	messageId: TMessageId | null;
	lastEdit: number;
	timer?: ReturnType<typeof setTimeout>;
	streamId?: string | null;
}
