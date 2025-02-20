export type TextItem = {
  type: 'text';
  text: string;
};

export type ContentItem = string | TextItem;

export interface MarkdownContentProps {
  content: string | ContentItem[] | TextItem;
}
