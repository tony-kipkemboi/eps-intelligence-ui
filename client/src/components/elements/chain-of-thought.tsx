import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useControllableState } from '@radix-ui/react-use-controllable-state';
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleIcon,
  CloudIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HashIcon,
  Loader2Icon,
  MailIcon,
  MessageSquareIcon,
  MicIcon,
  SearchIcon,
} from 'lucide-react';
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';

const AUTO_CLOSE_DELAY = 1000;

// Context for sharing state between ChainOfThought components
type ChainOfThoughtContextValue = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isStreaming: boolean;
  stepCount: number;
  completedCount: number;
};

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(
  null,
);

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext);
  if (!context) {
    throw new Error(
      'ChainOfThought components must be used within ChainOfThought',
    );
  }
  return context;
};

// Root component
type ChainOfThoughtProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  stepCount?: number;
  completedCount?: number;
};

export const ChainOfThought = memo(
  ({
    className,
    isStreaming = false,
    stepCount = 0,
    completedCount = 0,
    open,
    defaultOpen = true,
    onOpenChange,
    children,
    ...props
  }: ChainOfThoughtProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });
    const [hasAutoClosed, setHasAutoClosed] = useState(false);

    // Auto-close when all steps complete
    useEffect(() => {
      if (
        defaultOpen &&
        !isStreaming &&
        completedCount > 0 &&
        completedCount === stepCount &&
        isOpen &&
        !hasAutoClosed
      ) {
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [
      isStreaming,
      completedCount,
      stepCount,
      isOpen,
      defaultOpen,
      setIsOpen,
      hasAutoClosed,
    ]);

    return (
      <ChainOfThoughtContext.Provider
        value={{ isOpen, setIsOpen, isStreaming, stepCount, completedCount }}
      >
        <Collapsible
          className={cn('not-prose w-full', className)}
          open={isOpen}
          onOpenChange={setIsOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ChainOfThoughtContext.Provider>
    );
  },
);
ChainOfThought.displayName = 'ChainOfThought';

// Header component (trigger)
type ChainOfThoughtHeaderProps = ComponentProps<typeof CollapsibleTrigger> & {
  children?: ReactNode;
};

export const ChainOfThoughtHeader = memo(
  ({ className, children, ...props }: ChainOfThoughtHeaderProps) => {
    const { isOpen, isStreaming, stepCount, completedCount } =
      useChainOfThought();

    const allComplete = completedCount > 0 && completedCount === stepCount;

    return (
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted/50 hover:text-foreground',
          className,
        )}
        {...props}
      >
        <SearchIcon
          className={cn('size-4 shrink-0', isStreaming && 'animate-pulse')}
        />
        <span className="flex-1 text-left">
          {children ??
            (isStreaming
              ? `Thinking...`
              : allComplete
                ? `Show work • ${stepCount} source${stepCount !== 1 ? 's' : ''}`
                : `Processing ${completedCount}/${stepCount} steps`)}
        </span>
        <ChevronDownIcon
          className={cn(
            'size-4 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>
    );
  },
);
ChainOfThoughtHeader.displayName = 'ChainOfThoughtHeader';

// Content wrapper
type ChainOfThoughtContentProps = ComponentProps<typeof CollapsibleContent>;

export const ChainOfThoughtContent = memo(
  ({ className, children, ...props }: ChainOfThoughtContentProps) => (
    <CollapsibleContent
      className={cn(
        'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-hidden data-[state=closed]:animate-out data-[state=open]:animate-in',
        className,
      )}
      {...props}
    >
      <div className="space-y-1 py-2">{children}</div>
    </CollapsibleContent>
  ),
);
ChainOfThoughtContent.displayName = 'ChainOfThoughtContent';

// Individual step
type StepStatus = 'pending' | 'active' | 'complete' | 'error';

type ChainOfThoughtStepProps = ComponentProps<'div'> & {
  label: string;
  description?: string;
  status?: StepStatus;
};

const StatusIcon = ({ status }: { status: StepStatus }) => {
  switch (status) {
    case 'complete':
      return <CheckCircle2Icon className="size-4 text-green-500" />;
    case 'active':
      return <Loader2Icon className="size-4 animate-spin text-blue-500" />;
    case 'error':
      return <CircleIcon className="size-4 text-red-500" />;
    default:
      return <CircleIcon className="size-4 text-muted-foreground" />;
  }
};

export const ChainOfThoughtStep = memo(
  ({
    className,
    label,
    description,
    status = 'pending',
    children,
    ...props
  }: ChainOfThoughtStepProps) => {
    return (
      <div
        className={cn(
          'relative ml-3 border-muted border-l-2 pb-3 pl-4 last:border-transparent last:pb-0',
          className,
        )}
        {...props}
      >
        {/* Status dot positioned on the border */}
        <div className="-left-[9px] absolute top-0 flex size-4 items-center justify-center rounded-full bg-background">
          <StatusIcon status={status} />
        </div>

        {/* Step content */}
        <div className="space-y-2">
          <div className="min-w-0">
            <p className={cn(
              'font-medium text-sm',
              status === 'active' ? 'animate-shimmer-text' : 'text-foreground',
            )}>{label}</p>
            {description && (
              <p className="text-muted-foreground text-xs">{description}</p>
            )}
          </div>

          {/* Children (sources, details) - always visible */}
          {children && <div className="mt-2 space-y-3">{children}</div>}
        </div>
      </div>
    );
  },
);
ChainOfThoughtStep.displayName = 'ChainOfThoughtStep';

// Search results container
type ChainOfThoughtSearchResultsProps = ComponentProps<'div'>;

export const ChainOfThoughtSearchResults = memo(
  ({ className, children, ...props }: ChainOfThoughtSearchResultsProps) => (
    <div className={cn('flex flex-wrap gap-1.5', className)} {...props}>
      {children}
    </div>
  ),
);
ChainOfThoughtSearchResults.displayName = 'ChainOfThoughtSearchResults';

// Individual search result badge
type ChainOfThoughtSearchResultProps = ComponentProps<typeof Badge> & {
  href?: string;
  datasource?: string;
};

// Lucide icon components for datasources
const DatasourceIcon = ({ datasource }: { datasource?: string }) => {
  const iconClass = 'size-3 shrink-0';

  switch (datasource?.toLowerCase()) {
    case 'gdrive':
    case 'google drive':
      return <FileTextIcon className={iconClass} />;
    case 'salesforce':
    case 'salescloud':
      return <CloudIcon className={iconClass} />;
    case 'slack':
      return <MessageSquareIcon className={iconClass} />;
    case 'gmail':
      return <MailIcon className={iconClass} />;
    case 'gong':
      return <MicIcon className={iconClass} />;
    default:
      return <HashIcon className={iconClass} />;
  }
};

export const ChainOfThoughtSearchResult = memo(
  ({
    className,
    href,
    datasource,
    children,
    ...props
  }: ChainOfThoughtSearchResultProps) => {
    const content = (
      <Badge
        variant="secondary"
        className={cn(
          'max-w-[200px] cursor-pointer gap-1.5 truncate text-xs transition-colors hover:bg-secondary/80',
          href && 'hover:text-blue-600',
          className,
        )}
        {...props}
      >
        <DatasourceIcon datasource={datasource} />
        <span className="truncate">{children}</span>
        {href && <ExternalLinkIcon className="ml-0.5 size-3 shrink-0" />}
      </Badge>
    );

    if (href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      );
    }

    return content;
  },
);
ChainOfThoughtSearchResult.displayName = 'ChainOfThoughtSearchResult';

// Details section for showing full tool input/output
type ChainOfThoughtDetailsProps = ComponentProps<'div'> & {
  defaultOpen?: boolean;
};

export const ChainOfThoughtDetails = memo(
  ({
    className,
    defaultOpen = false,
    children,
    ...props
  }: ChainOfThoughtDetailsProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
      <div className={cn('mt-2', className)} {...props}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
        >
          {isOpen ? 'Hide details' : 'Show details'}
        </button>
        {isOpen && (
          <div className="mt-2 rounded-md border bg-muted/30 p-3">
            {children}
          </div>
        )}
      </div>
    );
  },
);
ChainOfThoughtDetails.displayName = 'ChainOfThoughtDetails';
