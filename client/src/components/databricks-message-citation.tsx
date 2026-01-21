import type { ChatMessage } from '@chat-template/core';
import type {
  AnchorHTMLAttributes,
  ComponentType,
  PropsWithChildren,
} from 'react';
import { cn } from '@/lib/utils';
import {
  InlineCitation,
  InlineCitationContent,
  InlineCitationSource,
  InlineCitationTrigger,
  useSourceRegistry,
  type SourceMetadata,
} from './elements/inline-citation';

/**
 * ReactMarkdown/Streamdown component that handles Databricks message citations.
 *
 * @example
 * <Streamdown components={{ a: DatabricksMessageCitationStreamdownIntegration }} />
 */
export const DatabricksMessageCitationStreamdownIntegration: ComponentType<
  AnchorHTMLAttributes<HTMLAnchorElement>
> = (props) => {
  if (isDatabricksMessageCitationLink(props.href)) {
    return (
      <DatabricksMessageCitationRenderer
        {...props}
        href={decodeDatabricksMessageCitationLink(props.href)}
      />
    );
  }
  return <DefaultAnchor {...props} />;
};

type SourcePart = Extract<ChatMessage['parts'][number], { type: 'source-url' }>;

// Adds a unique suffix to the link to indicate that it is a Databricks message citation.
const encodeDatabricksMessageCitationLink = (part: SourcePart) =>
  `${part.url}::databricks_citation`;

// Removes the unique suffix from the link to get the original link.
const decodeDatabricksMessageCitationLink = (link: string) =>
  link.replace('::databricks_citation', '');

// Creates a markdown link to the Databricks message citation.
export const createDatabricksMessageCitationMarkdown = (part: SourcePart) =>
  `[${part.title || part.url}](${encodeDatabricksMessageCitationLink(part)})`;

// Checks if the link is a Databricks message citation.
const isDatabricksMessageCitationLink = (
  link?: string,
): link is `${string}::databricks_citation` =>
  link?.endsWith('::databricks_citation') ?? false;

// Renders the Databricks message citation with rich hover card.
const DatabricksMessageCitationRenderer = (
  props: PropsWithChildren<{
    href: string;
  }>,
) => {
  const sourceRegistry = useSourceRegistry();
  const richSource = sourceRegistry?.getSource(props.href);

  // Build source metadata - use registry data if available, fallback to basic
  const source: SourceMetadata = richSource || {
    url: props.href,
    title: (props.children as string) || props.href,
  };

  return (
    <InlineCitation>
      <InlineCitationTrigger href={props.href}>
        {props.children}
      </InlineCitationTrigger>
      <InlineCitationContent>
        <InlineCitationSource source={source} />
      </InlineCitationContent>
    </InlineCitation>
  );
};

// Copied from streamdown
// https://github.com/vercel/streamdown/blob/dc5bd12e5709afce09814e47cf80884f8c665b3d/packages/streamdown/lib/components.tsx#L157-L181
const DefaultAnchor: ComponentType<AnchorHTMLAttributes<HTMLAnchorElement>> = (
  props,
) => {
  const isIncomplete = props.href === 'streamdown:incomplete-link';
  const isFootnoteLink = props.href?.startsWith('#');

  return (
    <a
      className={cn(
        'wrap-anywhere font-medium text-primary underline',
        props.className,
      )}
      data-incomplete={isIncomplete}
      data-streamdown="link"
      href={props.href}
      {...props}
      {...(isFootnoteLink
        ? {
            target: '_self',
          }
        : {
            target: '_blank',
            rel: 'noopener noreferrer',
          })}
    >
      {props.children}
    </a>
  );
};
