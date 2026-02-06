import type { ChatMessage } from '@chat-template/core';
import { createDatabricksMessageCitationMarkdown } from './databricks-message-citation';
import type { TextUIPart } from 'ai';

/**
 * Patterns that indicate agent narration text (should go in Chain of Thought, not main response).
 * These are short phrases the agent outputs between tool calls.
 */
const NARRATION_PATTERNS = [
  /^tool call$/i,
  /^(now )?let me (search|look|check|compile|find|get)/i,
  /^(now )?let me .* to (get|ensure|understand|compile|find)/i,
  /^searching /i,
  /^I('ll| will) (search|look|check|find|compile)/i,
  /^I('m| am) (searching|looking|checking|compiling|finding)/i,
  /^Based on (my |the )?(comprehensive |deep )?(research|search|analysis)/i,
];

/**
 * Check if raw text string matches narration patterns.
 */
export const isNarrationText = (text: string): boolean => {
  const trimmed = text.trim();

  // Only short text can be narration (prevents false positives on explanations)
  if (trimmed.length > 150) return false;

  // Don't filter if it looks like a question or explanation
  if (trimmed.includes('?')) return false;

  // Check against narration patterns
  return NARRATION_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/**
 * Checks if a text part is agent narration that should be moved to Chain of Thought.
 * Only matches short text (< 150 chars) that matches narration patterns.
 */
export const isNarrationPart = (
  part: ChatMessage['parts'][number],
): part is TextUIPart => {
  if (part.type !== 'text') return false;
  return isNarrationText(part.text || '');
};

/**
 * Creates segments of parts that can be rendered as a single component.
 * Used to render citations as part of the associated text.
 */
export const createMessagePartSegments = (parts: ChatMessage['parts']) => {
  // An array of arrays of parts
  // Allows us to render multiple parts as a single component
  const out: ChatMessage['parts'][] = [];
  for (const part of parts) {
    const lastBlock = out[out.length - 1] || null;
    const previousPart = lastBlock?.[lastBlock.length - 1] || null;

    // If the previous part is a text part and the current part is a source part, add it to the current block
    if (previousPart?.type === 'text' && part.type === 'source-url') {
      lastBlock.push(part);
    }
    // If the previous part is a source-url part and the current part is a source part, add it to the current block
    else if (
      previousPart?.type === 'source-url' &&
      part.type === 'source-url'
    ) {
      lastBlock.push(part);
    } else if (
      lastBlock?.[0]?.type === 'text' &&
      part.type === 'text' &&
      !isNamePart(part) &&
      !isNamePart(lastBlock[0]) &&
      // Don't merge narration parts - keep them separate so they can be filtered
      !isNarrationPart(part) &&
      !isNarrationPart(lastBlock[0])
    ) {
      // If the text part, or the previous part contains a <name></name> tag, add it to a new block
      // Otherwise, append sequential text parts to the same block
      lastBlock.push(part);
      //   }
    }
    // Otherwise, add the current part to a new block
    else {
      out.push([part]);
    }
  }

  return out;
};

export const isNamePart = (
  part: ChatMessage['parts'][number],
): part is TextUIPart => {
  return (
    part.type === 'text' &&
    part.text?.startsWith('<name>') &&
    part.text?.endsWith('</name>')
  );
};
export const formatNamePart = (part: ChatMessage['parts'][number]) => {
  if (!isNamePart(part)) return null;
  return part.text?.replace('<name>', '').replace('</name>', '');
};

/**
 * Strips narration lines from text content.
 * This is a safety net for any narration that slipped through part-level filtering.
 */
export const stripNarrationFromText = (text: string): string => {
  // Split by newlines, filter out narration lines, rejoin
  const lines = text.split('\n');
  const filteredLines = lines.filter((line) => !isNarrationText(line));
  return filteredLines.join('\n').trim();
};

/**
 * Takes a segment of parts and joins them into a markdown-formatted string.
 * Used to render citations as part of the associated text.
 */
export const joinMessagePartSegments = (parts: ChatMessage['parts']) => {
  const joined = parts.reduce((acc, part) => {
    switch (part.type) {
      case 'text':
        return acc + part.text;
      case 'source-url':
        // Special case for markdown tables
        if (acc.endsWith('|')) {
          // 1. Remove the last pipe
          // 2. Insert the citation markdown
          // 3. Add the pipe back
          return `${acc.slice(0, -1)} ${createDatabricksMessageCitationMarkdown(part)}|`;
        }
        return `${acc} ${createDatabricksMessageCitationMarkdown(part)}`;
      default:
        return acc;
    }
  }, '');

  // Strip any remaining narration lines as a safety net
  return stripNarrationFromText(joined);
};
