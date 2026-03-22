import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Heading, Bold, Italic, List, ListOrdered, Code, Link } from 'lucide-react';
import {
  applyBold,
  applyItalic,
  applyHeading,
  applyUnorderedList,
  applyOrderedList,
  applyCodeBlock,
  applyLink,
} from '../utils/markdownFormatting';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

type FormatAction = 'heading' | 'bold' | 'italic' | 'unordered-list' | 'ordered-list' | 'code' | 'link';

const TOOLBAR_ACTIONS: { action: FormatAction; icon: typeof Bold; label: string }[] = [
  { action: 'heading', icon: Heading, label: 'Heading' },
  { action: 'bold', icon: Bold, label: 'Bold' },
  { action: 'italic', icon: Italic, label: 'Italic' },
  { action: 'unordered-list', icon: List, label: 'Unordered List' },
  { action: 'ordered-list', icon: ListOrdered, label: 'Ordered List' },
  { action: 'code', icon: Code, label: 'Code Block' },
  { action: 'link', icon: Link, label: 'Link' },
];

const FORMAT_FN_MAP: Record<FormatAction, typeof applyBold> = {
  heading: applyHeading,
  bold: applyBold,
  italic: applyItalic,
  'unordered-list': applyUnorderedList,
  'ordered-list': applyOrderedList,
  code: applyCodeBlock,
  link: applyLink,
};

type EditorMode = 'edit' | 'preview';

const markdownComponents = {
  h1: ({ children, ...props }: React.ComponentPropsWithoutRef<'h1'>) => (
    <h1 className="text-3xl font-bold text-white mb-4 mt-6" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.ComponentPropsWithoutRef<'h2'>) => (
    <h2 className="text-2xl font-bold text-white mb-3 mt-5" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.ComponentPropsWithoutRef<'h3'>) => (
    <h3 className="text-xl font-bold text-white mb-3 mt-4" {...props}>{children}</h3>
  ),
  h4: ({ children, ...props }: React.ComponentPropsWithoutRef<'h4'>) => (
    <h4 className="text-lg font-bold text-white mb-2 mt-4" {...props}>{children}</h4>
  ),
  h5: ({ children, ...props }: React.ComponentPropsWithoutRef<'h5'>) => (
    <h5 className="text-base font-bold text-white mb-2 mt-3" {...props}>{children}</h5>
  ),
  h6: ({ children, ...props }: React.ComponentPropsWithoutRef<'h6'>) => (
    <h6 className="text-sm font-bold text-white mb-2 mt-3" {...props}>{children}</h6>
  ),
  p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
    <p className="text-neutral-200 leading-relaxed mb-4" {...props}>{children}</p>
  ),
  strong: ({ children, ...props }: React.ComponentPropsWithoutRef<'strong'>) => (
    <strong className="font-bold text-white" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }: React.ComponentPropsWithoutRef<'em'>) => (
    <em className="italic text-neutral-300" {...props}>{children}</em>
  ),
  ul: ({ children, ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
    <ul className="list-disc list-inside text-neutral-300 mb-4 ml-4 space-y-1" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
    <ol className="list-decimal list-inside text-neutral-300 mb-4 ml-4 space-y-1" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.ComponentPropsWithoutRef<'li'>) => (
    <li className="text-neutral-300" {...props}>{children}</li>
  ),
  a: ({ children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a className="text-fuchsia-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
  ),
  code: ({ children, className: codeClassName, ...props }: React.ComponentPropsWithoutRef<'code'> & { className?: string }) => {
    const isBlock = codeClassName?.startsWith('language-');
    if (isBlock) {
      return <code className={`${codeClassName ?? ''} text-sm`} {...props}>{children}</code>;
    }
    return <code className="bg-white/10 rounded px-1.5 py-0.5 font-mono text-sm text-amber-300" {...props}>{children}</code>;
  },
  pre: ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => (
    <pre className="bg-white/5 rounded-xl p-4 font-mono text-sm overflow-x-auto mb-4" {...props}>{children}</pre>
  ),
  blockquote: ({ children, ...props }: React.ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote className="border-l-4 border-white/20 pl-4 italic text-neutral-400 mb-4" {...props}>{children}</blockquote>
  ),
  hr: (props: React.ComponentPropsWithoutRef<'hr'>) => (
    <hr className="border-white/10 my-6" {...props} />
  ),
  table: ({ children, ...props }: React.ComponentPropsWithoutRef<'table'>) => (
    <table className="w-full border-collapse mb-4 text-neutral-200" {...props}>{children}</table>
  ),
  th: ({ children, ...props }: React.ComponentPropsWithoutRef<'th'>) => (
    <th className="border border-white/10 px-3 py-2 text-left font-bold text-white bg-white/5" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: React.ComponentPropsWithoutRef<'td'>) => (
    <td className="border border-white/10 px-3 py-2 text-neutral-300" {...props}>{children}</td>
  ),
};

export function MarkdownEditor({ value, onChange, placeholder, autoFocus, className }: MarkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>('edit');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleFormat = useCallback(
    (action: FormatAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart, selectionEnd } = textarea;
      const formatFn = FORMAT_FN_MAP[action];
      const result = formatFn(value, selectionStart, selectionEnd);

      onChange(result.text);

      // Restore selection after React re-renders the textarea
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    },
    [value, onChange],
  );

  return (
    <div className={`flex flex-col ${className ?? ''}`}>
      {/* Header bar with edit/preview toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              mode === 'edit'
                ? 'bg-white/10 text-white'
                : 'bg-transparent text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              mode === 'preview'
                ? 'bg-white/10 text-white'
                : 'bg-transparent text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Formatting toolbar — edit mode only */}
      {mode === 'edit' && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-white/10" role="toolbar" aria-label="Formatting toolbar">
          {TOOLBAR_ACTIONS.map(({ action, icon: Icon, label }) => (
            <button
              key={action}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => handleFormat(action)}
              className="p-1.5 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-lg transition-colors"
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      )}

      {/* Edit mode: textarea */}
      {mode === 'edit' && (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 w-full bg-transparent resize-none border-none text-neutral-200 text-base leading-relaxed p-4 focus:outline-none focus:ring-0 placeholder:text-neutral-700"
        />
      )}

      {/* Preview mode: rendered markdown */}
      {mode === 'preview' && (
        <div className="flex-1 overflow-y-auto p-4 text-neutral-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{value}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
