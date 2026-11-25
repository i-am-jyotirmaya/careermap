import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RotateCw, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { NEO_SPRING } from '@/components/ui/motion-primitives';
import { cn } from '@/lib/utils';
import type { FlashcardItem } from '../../shared/types.ts';

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded-[4px] bg-[#FFDC58]/50 border border-black px-1.5 py-0.5 text-xs text-black font-mono font-bold"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-heading font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="rounded-[3px] bg-[#88AAEE]/35 px-1 font-heading font-bold text-foreground underline decoration-black decoration-2 underline-offset-2 transition-colors hover:bg-[#FFDC58]"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const MarkdownView: React.FC<{ content: string; className?: string }> = ({
  content,
  className = '',
}) => {
  if (!content) return null;

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <div
          key={`code-${i}`}
          className="my-4 overflow-hidden rounded-base border-2 border-black bg-[#111111] text-[#05E17A] shadow-[4px_4px_0px_0px_#000]"
        >
          <div className="flex items-center justify-between border-b-2 border-black bg-[#FFDC58] px-3.5 py-1.5 text-black">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-black bg-[#FF6B6B]" />
              <span className="h-2.5 w-2.5 rounded-full border border-black bg-white" />
              <span className="h-2.5 w-2.5 rounded-full border border-black bg-[#05E17A]" />
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-extrabold uppercase tracking-wider text-black">
              <Terminal className="h-3 w-3" />
              {lang || 'code'}
            </span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-[#05E17A]">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push(
        <h4
          key={`h3-${i}`}
          className="mt-4 mb-1.5 border-b-2 border-border pb-1 font-heading text-sm font-bold text-foreground"
        >
          {renderInline(line.slice(4))}
        </h4>
      );
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push(
        <h3
          key={`h2-${i}`}
          className="mt-5 mb-2 border-b-2 border-border pb-1 font-heading text-base font-bold text-foreground"
        >
          {renderInline(line.slice(3))}
        </h3>
      );
      i++;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push(
        <h2
          key={`h1-${i}`}
          className="mt-5 mb-2.5 border-b-2 border-border pb-1.5 font-heading text-lg font-extrabold text-foreground"
        >
          {renderInline(line.slice(2))}
        </h2>
      );
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul
          key={`ul-${i}`}
          className="my-2.5 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90 marker:font-bold marker:text-black"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol
          key={`ol-${i}`}
          className="my-2.5 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90 marker:font-bold marker:text-black"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="my-2.5 text-sm leading-relaxed text-foreground/90">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className={className}>{blocks}</div>;
};

export const FlashcardDeck: React.FC<{ cards: FlashcardItem[] }> = ({ cards }) => {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  if (!cards || cards.length === 0) return null;

  const flippedCount = Object.values(flipped).filter(Boolean).length;

  return (
    <div className="mt-6 border-t-2 border-border pt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Badge variant="yellow" className="uppercase tracking-wider">
          Active Recall Flashcards (Click to Flip)
        </Badge>
        <span className="font-mono text-xs font-bold text-muted-foreground">
          {flippedCount}/{cards.length} Flipped
        </span>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {cards.map((c, idx) => {
          const isBack = Boolean(flipped[idx]);
          return (
            <motion.button
              key={idx}
              type="button"
              layout
              whileTap={{ scale: 0.985 }}
              transition={NEO_SPRING}
              onClick={() => setFlipped((prev) => ({ ...prev, [idx]: !prev[idx] }))}
              className={cn(
                'group relative flex min-h-[124px] cursor-pointer flex-col justify-between overflow-hidden rounded-base border-2 border-border p-4 text-left shadow-shadow neo-press',
                isBack ? 'bg-[#05E17A]/35' : 'bg-secondary-background hover:bg-[#FFFDF7]'
              )}
            >
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-[4px] border border-black px-2 py-0.5 font-heading text-[10px] font-extrabold uppercase tracking-wider text-black shadow-[1px_1px_0px_0px_#000]',
                    isBack ? 'bg-[#05E17A]' : 'bg-[#FFDC58]'
                  )}
                >
                  {isBack ? 'Answer' : `Prompt #${idx + 1}`}
                </span>
                <motion.span
                  animate={{ rotate: isBack ? 180 : 0 }}
                  transition={NEO_SPRING}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-black bg-white text-black shadow-[1px_1px_0px_0px_#000] group-hover:bg-[#88AAEE]"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </motion.span>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={isBack ? 'back' : 'front'}
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={NEO_SPRING}
                >
                  <p className="text-sm font-medium leading-relaxed text-foreground">
                    {isBack ? c.back : c.front}
                  </p>
                </motion.div>
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
