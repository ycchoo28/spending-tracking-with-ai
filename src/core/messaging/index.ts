/**
 * Messaging abstraction layer exports
 * 
 * This module provides a platform-agnostic messaging interface that allows
 * the workflow orchestrator to communicate with different messaging platforms
 * (Telegram, Console, WhatsApp, etc.) without knowing platform-specific details.
 * 
 * Key components:
 * - MessagingAdapter: Interface that all platforms must implement
 * - TelegramAdapter: Implementation for Telegram Bot API
 * - ConsoleAdapter: Implementation for CLI/testing
 * - Types: Platform-agnostic message types
 */

export * from './types';
export * from './messaging-adapter';
export * from './telegram-adapter';
export * from './console-adapter';