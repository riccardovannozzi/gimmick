'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownPreviewProps {
  markdown: string;
  className?: string;
}

/**
 * Read-only markdown renderer used by the TileSidebar text-spark preview and
 * everywhere we want to display the same markdown content the MarkdownEditor
 * produces. Pairs with the project's pixel theme via tailwind utility classes
 * applied inside via the `prose-tweaks` className.
 */
export function MarkdownPreview({ markdown, className }: MarkdownPreviewProps) {
  return (
    <div className={cn('markdown-preview', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
