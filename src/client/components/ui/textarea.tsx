import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-[84px] w-full rounded-base border-2 border-border bg-secondary-background selection:bg-main selection:text-main-foreground px-3.5 py-2.5 text-sm font-base text-foreground shadow-[2px_2px_0px_0px_var(--border)] transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] placeholder:text-foreground/45 focus-visible:outline-none focus-visible:translate-x-[1px] focus-visible:translate-y-[1px] focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
