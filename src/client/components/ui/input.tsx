import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-10 w-full rounded-base border-2 border-border bg-secondary-background selection:bg-main selection:text-main-foreground px-3.5 py-2 text-sm font-base text-foreground shadow-[2px_2px_0px_0px_var(--border)] transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] file:border-0 file:bg-transparent file:text-sm file:font-heading placeholder:text-foreground/45 focus-visible:outline-hidden focus-visible:translate-x-[1px] focus-visible:translate-y-[1px] focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Input };
