import { useControllableState } from '@radix-ui/react-use-controllable-state';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronRightIcon, SparklesIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { createContext, memo, useContext, useEffect, useState } from 'react';
import { Response } from './response';

type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error('Reasoning components must be used within Reasoning');
  }
  return context;
};

type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

const AUTO_CLOSE_DELAY = 500;
const MS_IN_S = 1000;

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });
    const [duration, setDuration] = useControllableState({
      prop: durationProp,
      defaultProp: 0,
    });

    const [hasAutoClosedRef, setHasAutoClosedRef] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now());
        }
      } else if (startTime !== null) {
        setDuration(Math.round((Date.now() - startTime) / MS_IN_S));
        setStartTime(null);
      }
    }, [isStreaming, startTime, setDuration]);

    // Auto-open when streaming starts, auto-close when streaming ends (once only)
    useEffect(() => {
      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosedRef) {
        // Add a small delay before closing to allow user to see the content
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosedRef(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosedRef]);

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen);
    };

    return (
      <ReasoningContext.Provider
        value={{ isStreaming, isOpen, setIsOpen, duration }}
      >
        <Collapsible
          className={cn('not-prose w-full', className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  },
);

type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  title?: string;
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode;
};

// Format duration in a natural way
function formatDuration(seconds: number): string {
  if (seconds < 1) return 'a moment';
  if (seconds === 1) return 'a second';
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return minutes === 1 ? 'a minute' : `${minutes} minutes`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

// Default message generator
function defaultThinkingMessage(
  isStreaming: boolean,
  duration?: number,
): ReactNode {
  if (isStreaming) {
    return 'Thinking...';
  }
  if (duration && duration > 0) {
    return `Thought for ${formatDuration(duration)}`;
  }
  return 'Thoughts';
}

export const ReasoningTrigger = memo(
  ({
    className,
    title,
    getThinkingMessage = defaultThinkingMessage,
    children,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning();

    return (
      <CollapsibleTrigger
        className={cn(
          'group flex items-center gap-2 rounded-lg px-2 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted/50 hover:text-foreground',
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            {/* Pulsing indicator when streaming */}
            <div className="relative flex size-5 items-center justify-center">
              {isStreaming && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40" />
              )}
              <SparklesIcon
                className={cn(
                  'relative size-4',
                  isStreaming && 'text-primary',
                )}
              />
            </div>

            {/* Message text */}
            <span className={cn(isStreaming && 'text-foreground')}>
              {title || getThinkingMessage(isStreaming, duration)}
            </span>

            {/* Chevron */}
            <ChevronRightIcon
              className={cn(
                'ml-auto size-4 transition-transform duration-200',
                isOpen && 'rotate-90',
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  },
);

type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: string;
};

export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => (
    <CollapsibleContent
      className={cn(
        'overflow-hidden',
        'data-[state=closed]:animate-out data-[state=open]:animate-in',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2',
        className,
      )}
      {...props}
    >
      <div className="mt-2 rounded-lg border border-dashed bg-muted/30 p-3">
        <Response className="prose-sm text-muted-foreground text-xs leading-relaxed">
          {children}
        </Response>
      </div>
    </CollapsibleContent>
  ),
);

Reasoning.displayName = 'Reasoning';
ReasoningTrigger.displayName = 'ReasoningTrigger';
ReasoningContent.displayName = 'ReasoningContent';
