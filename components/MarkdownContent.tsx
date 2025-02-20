import ReactMarkdown from 'react-markdown';
import { MarkdownContentProps } from '@/types/markdown';

export function MarkdownContent({ content }: MarkdownContentProps) {
  const markdownComponents = {
    a: ({ ...props }) => (
      <a
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
  };

  const getMarkdownText = (content: MarkdownContentProps['content']) => {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item.type === 'text') return item.text;
          return null;
        })
        .filter(Boolean)
        .join(' ');
    }
    if (content?.type === 'text') {
      return content.text;
    }
    return JSON.stringify(content);
  };

  return (
    <ReactMarkdown
      components={markdownComponents}
      className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-2 [&_a:hover]:text-blue-600 [&_a]:text-blue-500 [&_a]:no-underline hover:[&_a]:underline [&_li]:my-0 [&_li]:leading-[normal] [&_li_p]:my-0 [&_ol+p]:mt-0 [&_ol]:my-0 [&_ol]:pl-0 [&_ol]:leading-[0] [&_ol_li]:my-0 [&_ol_li_p]:my-0 [&_p+ol]:mt-0 [&_p]:my-0 [&_ul]:pl-0 [&_ul]:leading-none"
    >
      {getMarkdownText(content)}
    </ReactMarkdown>
  );
}
