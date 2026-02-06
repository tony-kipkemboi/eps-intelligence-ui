import { motion } from 'framer-motion';
import React, { memo, useState } from 'react';
import { AnimatedAssistantIcon } from './animation-assistant-icon';
import { Response } from './elements/response';
import { MessageContent } from './elements/message';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtDetails,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from './elements/chain-of-thought';
import { ToolInput, ToolOutput } from './elements/tool';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import { MessageEditor } from './message-editor';
import { MessageReasoning } from './message-reasoning';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@chat-template/core';
import { useDataStream } from './data-stream-provider';
import {
  createMessagePartSegments,
  formatNamePart,
  isNamePart,
  joinMessagePartSegments,
} from './databricks-message-part-transformers';
import { MessageError } from './message-error';
import { Streamdown } from 'streamdown';
import { DATABRICKS_TOOL_CALL_ID } from '@chat-template/ai-sdk-providers/tools';
import {
  getToolDisplayName,
  parseToolOutputSources,
  type ParsedSource,
} from '@/lib/parse-tool-output';
import { SourceRegistryProvider } from './elements/inline-citation';

// Type for tool parts
type ToolPart = ChatMessage['parts'][number] & {
  type: `tool-${typeof DATABRICKS_TOOL_CALL_ID}`;
  toolCallId: string;
  input: unknown;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  output?: unknown;
  errorText?: string;
  callProviderMetadata?: {
    databricks?: {
      toolName?: string;
    };
  };
};

// Helper to check if a part is a tool part
const isToolPart = (
  part: ChatMessage['parts'][number],
): part is ToolPart => {
  return part.type === `tool-${DATABRICKS_TOOL_CALL_ID}`;
};

// Group consecutive tool parts together
const _groupToolParts = (
  segments: ChatMessage['parts'][],
): Array<{ type: 'tools'; parts: ToolPart[] } | { type: 'other'; parts: ChatMessage['parts'] }> => {
  const result: Array<
    { type: 'tools'; parts: ToolPart[] } | { type: 'other'; parts: ChatMessage['parts'] }
  > = [];

  for (const segment of segments) {
    const [part] = segment;

    if (isToolPart(part)) {
      // Check if the last group is a tools group
      const lastGroup = result[result.length - 1];
      if (lastGroup?.type === 'tools') {
        lastGroup.parts.push(part);
      } else {
        result.push({ type: 'tools', parts: [part] });
      }
    } else {
      result.push({ type: 'other', parts: segment });
    }
  }

  return result;
};

const PurePreviewMessage = ({
  message,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding,
}: {
  chatId: string;
  message: ChatMessage;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [showErrors, setShowErrors] = useState(false);

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === 'file',
  );

  // Extract error parts separately
  const errorParts = React.useMemo(
    () => message.parts.filter((part) => part.type === 'data-error'),
    [message.parts],
  );

  useDataStream();

  const partSegments = React.useMemo(
    /**
     * We segment message parts into segments that can be rendered as a single component.
     * Used to render citations as part of the associated text.
     */
    () =>
      createMessagePartSegments(
        message.parts.filter((part) => part.type !== 'data-error'),
      ),
    [message.parts],
  );

  // Collect all tool parts for a single Chain of Thought section
  const allToolParts = React.useMemo(() => {
    return message.parts.filter(isToolPart);
  }, [message.parts]);

  // Find the index of the last tool part — any text before this is narration
  const lastToolPartIndex = React.useMemo(() => {
    for (let i = message.parts.length - 1; i >= 0; i--) {
      if (isToolPart(message.parts[i])) return i;
    }
    return -1;
  }, [message.parts]);

  // Position-based narration: any non-empty text part before the last tool call
  // is intermediate agent narration (e.g. "Let me search...", "Based on the results...")
  const narrationParts = React.useMemo(() => {
    return message.parts
      .map((part, index) => ({ part, index }))
      .filter(({ part, index }) =>
        part.type === 'text' &&
        part.text?.trim() &&
        index < lastToolPartIndex &&
        !isNamePart(part)
      );
  }, [message.parts, lastToolPartIndex]);

  // Collect reasoning parts to render before Chain of Thought
  const reasoningParts = React.useMemo(() => {
    return message.parts
      .map((part, index) => ({ part, index }))
      .filter(({ part }) => part.type === 'reasoning' && part.text?.trim().length > 0);
  }, [message.parts]);

  // Set of part indices that belong in Chain of Thought (tools, narration, reasoning)
  const cotPartIndices = React.useMemo(() => {
    const indices = new Set<number>();
    message.parts.forEach((part, index) => {
      if (isToolPart(part)) indices.add(index);
      if (part.type === 'reasoning') indices.add(index);
    });
    for (const { index } of narrationParts) {
      indices.add(index);
    }
    return indices;
  }, [message.parts, narrationParts]);

  // Filter segments to only include parts NOT in the Chain of Thought
  const nonToolSegments = React.useMemo(
    () => partSegments.filter(segment => {
      const part = segment[0];
      // Find this part's index in the original parts array
      const partIndex = message.parts.indexOf(part);
      return !cotPartIndices.has(partIndex);
    }),
    [partSegments, cotPartIndices, message.parts],
  );

  // Build source registry from all tool outputs for rich citation hover cards
  const sourceRegistry = React.useMemo(() => {
    const allSources: ParsedSource[] = [];
    
    for (const part of message.parts) {
      if (isToolPart(part) && part.state === 'output-available' && part.output) {
        const output = typeof part.output === 'string'
          ? part.output
          : JSON.stringify(part.output);
        const sources = parseToolOutputSources(output);
        allSources.push(...sources);
      }
    }
    
    return allSources;
  }, [message.parts]);

  // Check if message only contains errors (no other content)
  const hasOnlyErrors = React.useMemo(() => {
    const nonErrorParts = message.parts.filter(
      (part) => part.type !== 'data-error',
    );
    return errorParts.length > 0 && nonErrorParts.length === 0;
  }, [message.parts, errorParts.length]);

  return (
    <div
      data-testid={`message-${message.role}`}
      className="group/message w-full"
      data-role={message.role}
    >
      <div
        className={cn('flex w-full items-start gap-2 md:gap-3', {
          'justify-end': message.role === 'user',
          'justify-start': message.role === 'assistant',
        })}
      >
        {message.role === 'assistant' && (
          <AnimatedAssistantIcon size={14} isLoading={isLoading} />
        )}

        <div
          className={cn('flex min-w-0 flex-col', {
            'gap-2 md:gap-4': message.parts?.some(
              (p) => p.type === 'text' && p.text?.trim(),
            ),
            'w-full': message.role === 'assistant' || mode === 'edit',
            'min-h-96': message.role === 'assistant' && requiresScrollPadding,
            'max-w-[70%] sm:max-w-[min(fit-content,80%)]':
              message.role === 'user' && mode !== 'edit',
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              data-testid={`message-attachments`}
              className="flex flex-row justify-end gap-2"
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  key={attachment.url}
                  attachment={{
                    name: attachment.filename ?? 'file',
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                />
              ))}
            </div>
          )}

          {/* Render reasoning (thinking) before tool calls */}
          {reasoningParts.map(({ part, index }) => (
            <MessageReasoning
              key={`reasoning-${index}`}
              isLoading={isLoading && part.state === 'streaming'}
              reasoning={part.text}
            />
          ))}

          {/* Render all tool calls and narration in a single Chain of Thought section */}
          {(allToolParts.length > 0 || narrationParts.length > 0) && (
            <ChainOfThought
              key={`message-${message.id}-tools`}
              defaultOpen={false}
              isStreaming={allToolParts.some(
                (p) => p.state === 'input-streaming' || p.state === 'input-available',
              )}
              stepCount={allToolParts.length}
              completedCount={allToolParts.filter((p) => p.state === 'output-available').length}
            >
              <ChainOfThoughtHeader />
              <ChainOfThoughtContent>
                {/* Show all sources at top level */}
                {(() => {
                  const allSources = allToolParts.flatMap((toolPart) => {
                    const output =
                      typeof toolPart.output === 'string'
                        ? toolPart.output
                        : JSON.stringify(toolPart.output, null, 2);
                    return parseToolOutputSources(output || '');
                  });

                  return allSources.length > 0 ? (
                    <div className="mb-4 space-y-2 px-3">
                      <h4 className='font-medium text-muted-foreground text-xs uppercase tracking-wide'>
                        Sources Found
                      </h4>
                      <ChainOfThoughtSearchResults>
                        {allSources.map((source) => (
                          <ChainOfThoughtSearchResult
                            key={source.url}
                            href={source.url}
                            datasource={source.datasource}
                          >
                            {source.title}
                          </ChainOfThoughtSearchResult>
                        ))}
                      </ChainOfThoughtSearchResults>
                    </div>
                  ) : null;
                })()}

                {/* Render narration and tool steps interleaved in original order */}
                {(() => {
                  // Build a combined list sorted by position in original parts
                  const steps: Array<{ index: number; type: 'narration' | 'tool'; part: ChatMessage['parts'][number] }> = [];

                  for (const { part, index } of narrationParts) {
                    steps.push({ index, type: 'narration', part });
                  }
                  for (const toolPart of allToolParts) {
                    const idx = message.parts.indexOf(toolPart);
                    steps.push({ index: idx, type: 'tool', part: toolPart });
                  }
                  steps.sort((a, b) => a.index - b.index);

                  return steps.map(({ index, type, part }) => {
                    if (type === 'narration') {
                      const text = part.type === 'text' ? part.text?.trim() : '';
                      // Skip MLflow "tool call" placeholder — not real narration
                      if (!text || text.toLowerCase() === 'tool call') return null;
                      return (
                        <ChainOfThoughtStep
                          key={`narration-${index}`}
                          label="Thinking"
                          status="complete"
                        >
                          <p className='pl-1 text-muted-foreground text-sm'>
                            {text}
                          </p>
                        </ChainOfThoughtStep>
                      );
                    }

                    const toolPart = part as ToolPart;
                    const toolName = toolPart.callProviderMetadata?.databricks?.toolName;
                    const displayName = getToolDisplayName(toolName);
                    const output =
                      typeof toolPart.output === 'string'
                        ? toolPart.output
                        : JSON.stringify(toolPart.output, null, 2);
                    const status =
                      toolPart.state === 'output-available'
                        ? 'complete'
                        : toolPart.state === 'output-error'
                          ? 'error'
                          : toolPart.state === 'input-available'
                            ? 'active'
                            : 'pending';

                    return (
                      <ChainOfThoughtStep
                        key={toolPart.toolCallId}
                        label={displayName}
                        status={status}
                      >
                        <ChainOfThoughtDetails>
                          <ToolInput input={toolPart.input} />
                          {toolPart.state === 'output-available' && (
                            <ToolOutput
                              output={
                                <div className="whitespace-pre-wrap font-mono text-sm">
                                  {output}
                                </div>
                              }
                              errorText={undefined}
                            />
                          )}
                          {toolPart.state === 'output-error' && toolPart.errorText && (
                            <div className="rounded border border-red-200 bg-red-50 p-2 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                              Error: {toolPart.errorText}
                            </div>
                          )}
                        </ChainOfThoughtDetails>
                      </ChainOfThoughtStep>
                    );
                  });
                })()}
              </ChainOfThoughtContent>
            </ChainOfThought>
          )}

          {/* Render non-tool parts */}
          {nonToolSegments?.map((segment, segmentIndex) => {
            const key = `message-${message.id}-segment-${segmentIndex}`;
            const parts = segment;
            const [part] = parts;
            const { type } = part;

            if (type === 'text') {
              if (isNamePart(part)) {
                return (
                  <Streamdown
                    key={key}
                    className="-mb-2 mt-0 border-l-4 pl-2 text-muted-foreground"
                  >{`# ${formatNamePart(part)}`}</Streamdown>
                );
              }
              if (mode === 'view') {
                return (
                  <div key={key}>
                    <MessageContent
                      data-testid="message-content"
                      className={cn({
                        'w-fit break-words rounded-2xl bg-muted px-3 py-2 text-left text-foreground':
                          message.role === 'user',
                        'bg-transparent px-0 py-0 text-left':
                          message.role === 'assistant',
                      })}
                    >
                      <SourceRegistryProvider sources={sourceRegistry}>
                        <Response>
                          {sanitizeText(joinMessagePartSegments(parts))}
                        </Response>
                      </SourceRegistryProvider>
                    </MessageContent>
                  </div>
                );
              }

              if (mode === 'edit') {
                return (
                  <div
                    key={key}
                    className="flex w-full flex-row items-start gap-3"
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        regenerate={regenerate}
                      />
                    </div>
                  </div>
                );
              }
            }

            // Support for citations/annotations
            if (type === 'source-url') {
              return (
                <a
                  key={key}
                  href={part.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-baseline text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <sup className="text-xs">[{part.title || part.url}]</sup>
                </a>
              );
            }

            return null;
          })}

          {!isReadonly && !hasOnlyErrors && (
            <MessageActions
              key={`action-${message.id}`}
              message={message}
              isLoading={isLoading}
              setMode={setMode}
              errorCount={errorParts.length}
              showErrors={showErrors}
              onToggleErrors={() => setShowErrors(!showErrors)}
            />
          )}

          {errorParts.length > 0 && (hasOnlyErrors || showErrors) && (
            <div className="flex flex-col gap-2">
              {errorParts.map((part, index) => (
                <MessageError
                  key={`error-${message.id}-${index}`}
                  error={part.data}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;

    return false;
  },
);

export const AwaitingResponseMessage = () => {
  const role = 'assistant';

  return (
    <div
      data-testid="message-assistant-loading"
      className="group/message w-full"
      data-role={role}
    >
      <div className="flex items-start justify-start gap-3">
        <AnimatedAssistantIcon size={14} isLoading={false} muted={true} />

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="p-0 text-muted-foreground text-sm">
            <LoadingText>Thinking...</LoadingText>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingText = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      animate={{ backgroundPosition: ['100% 50%', '-100% 50%'] }}
      transition={{
        duration: 1.5,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'linear',
      }}
      style={{
        background:
          'linear-gradient(90deg, hsl(var(--muted-foreground)) 0%, hsl(var(--muted-foreground)) 35%, hsl(var(--foreground)) 50%, hsl(var(--muted-foreground)) 65%, hsl(var(--muted-foreground)) 100%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
      }}
      className="flex items-center text-transparent"
    >
      {children}
    </motion.div>
  );
};
