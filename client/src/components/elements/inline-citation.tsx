import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  CloudIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HashIcon,
  MailIcon,
  MessageSquareIcon,
  MicIcon,
  UserIcon,
} from 'lucide-react';
import {
  createContext,
  forwardRef,
  memo,
  useContext,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';

// Rich source metadata type
export interface SourceMetadata {
  url: string;
  title: string;
  content?: string;
  datasource?: string;
  author?: string;
  updatedAt?: string;
}

// Context for source registry
type SourceRegistryContextValue = {
  getSource: (url: string) => SourceMetadata | undefined;
};

const SourceRegistryContext = createContext<SourceRegistryContextValue | null>(
  null,
);

export const SourceRegistryProvider = ({
  sources,
  children,
}: {
  sources: SourceMetadata[];
  children: ReactNode;
}) => {
  const sourceMap = new Map(sources.map((s) => [s.url, s]));

  return (
    <SourceRegistryContext.Provider
      value={{ getSource: (url) => sourceMap.get(url) }}
    >
      {children}
    </SourceRegistryContext.Provider>
  );
};

export const useSourceRegistry = () => {
  return useContext(SourceRegistryContext);
};

// Root component
const InlineCitation = forwardRef<
  ElementRef<typeof HoverCardPrimitive.Root>,
  ComponentPropsWithoutRef<typeof HoverCardPrimitive.Root>
>(({ children, ...props }, _ref) => (
  <HoverCardPrimitive.Root openDelay={200} closeDelay={100} {...props}>
    {children}
  </HoverCardPrimitive.Root>
));
InlineCitation.displayName = 'InlineCitation';

// Trigger (the citation pill)
type InlineCitationTriggerProps = ComponentPropsWithoutRef<
  typeof HoverCardPrimitive.Trigger
> & {
  href?: string;
  sourceCount?: number;
};

const InlineCitationTrigger = forwardRef<
  ElementRef<typeof HoverCardPrimitive.Trigger>,
  InlineCitationTriggerProps
>(({ className, href, sourceCount, children, ...props }, ref) => {
  const hostname = href ? getHostname(href) : null;

  return (
    <HoverCardPrimitive.Trigger
      ref={ref}
      asChild
      className={cn('cursor-pointer', className)}
      {...props}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className='inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-medium text-secondary-foreground text-xs transition-colors hover:bg-secondary/80'
      >
        <span className="max-w-[120px] truncate">
          {children || hostname || 'Source'}
        </span>
        {sourceCount && sourceCount > 1 && (
          <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
            +{sourceCount - 1}
          </span>
        )}
        <ExternalLinkIcon className="size-3 shrink-0 opacity-60" />
      </a>
    </HoverCardPrimitive.Trigger>
  );
});
InlineCitationTrigger.displayName = 'InlineCitationTrigger';

// Content card
const InlineCitationContent = forwardRef<
  ElementRef<typeof HoverCardPrimitive.Content>,
  ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = 'start', sideOffset = 8, ...props }, ref) => (
  <HoverCardPrimitive.Portal>
    <HoverCardPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-80 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg outline-none',
        'data-[state=closed]:animate-out data-[state=open]:animate-in',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    />
  </HoverCardPrimitive.Portal>
));
InlineCitationContent.displayName = 'InlineCitationContent';

// Source info component
type InlineCitationSourceProps = ComponentPropsWithoutRef<'div'> & {
  source: SourceMetadata;
};

const DatasourceIcon = ({
  datasource,
  className,
}: {
  datasource?: string;
  className?: string;
}) => {
  const iconClass = cn('size-4 shrink-0', className);

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
    case 'looker':
      return <HashIcon className={iconClass} />;
    default:
      return <FileTextIcon className={iconClass} />;
  }
};

const InlineCitationSource = memo(
  ({ className, source, ...props }: InlineCitationSourceProps) => {
    const hostname = getHostname(source.url);

    return (
      <div className={cn('space-y-3', className)} {...props}>
        {/* Header with datasource icon and hostname */}
        <div className="flex items-center gap-2">
          <DatasourceIcon
            datasource={source.datasource}
            className="text-muted-foreground"
          />
          <span className='text-muted-foreground text-xs'>{hostname}</span>
        </div>

        {/* Title */}
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-medium text-sm leading-snug hover:text-primary hover:underline"
        >
          {source.title}
        </a>

        {/* Content snippet */}
        {source.content && (
          <p className='line-clamp-3 text-muted-foreground text-xs leading-relaxed'>
            {source.content}
          </p>
        )}

        {/* Metadata row */}
        {(source.author || source.updatedAt) && (
          <div className='flex flex-wrap items-center gap-3 text-muted-foreground text-xs'>
            {source.author && (
              <span className="flex items-center gap-1">
                <UserIcon className="size-3" />
                {source.author}
              </span>
            )}
            {source.updatedAt && (
              <span className="flex items-center gap-1">
                <CalendarIcon className="size-3" />
                {formatDate(source.updatedAt)}
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
);
InlineCitationSource.displayName = 'InlineCitationSource';

// Helper functions
function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export {
  InlineCitation,
  InlineCitationTrigger,
  InlineCitationContent,
  InlineCitationSource,
  DatasourceIcon,
  getHostname,
};

