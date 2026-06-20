/**
 * Message service for sending notifications
 */

import { existsSync } from "node:fs";
import type {
	MessagePayload,
	MessageResult,
	MessengerService,
} from "./types.js";

export class MessengerServiceImpl implements MessengerService {
	async send(payload: MessagePayload): Promise<MessageResult> {
		const { content, channel, prefix, username, filePath } = payload;

		// Build the message
		let message = content;
		if (prefix) {
			message = `${prefix}: ${content}`;
		}
		if (username) {
			message = `[${username}] ${message}`;
		}

		// If a file path is provided, return it for the caller to attach
		if (filePath && existsSync(filePath)) {
			return {
				success: true,
				channel: channel ?? "default",
				messageId: filePath,
			};
		}

		// For now, log the message (actual delivery depends on channel config)
		console.log(`[Message to ${channel ?? "default"}]: ${message}`);

		return {
			success: true,
			channel: channel ?? "default",
			messageId: `msg-${Date.now()}`,
		};
	}
}
