import * as React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface ProgressProps extends React.ComponentProps<'div'> {
  value: number;
  indicatorClassName?: string;
}

export function Progress({
  value,
  className,
  indicatorClassName,
  ...props
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn(
        'relative h-4 w-full overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-[2px_2px_0px_0px_var(--border)]',
        className
      )}
      {...props}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        className={cn(
          'h-full bg-main transition-colors',
          clamped > 0 && clamped < 100 && 'border-r-2 border-border',
          indicatorClassName
        )}
      />
    </div>
  );
}
