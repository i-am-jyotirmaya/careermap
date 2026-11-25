import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import * as React from 'react';
import { cn } from '@/lib/utils';

function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default';
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-border bg-secondary-background shadow-[2px_2px_0px_0px_var(--border)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:bg-main data-unchecked:bg-secondary-background',
        size === 'default' && 'h-7 w-13',
        size === 'sm' && 'h-5.5 w-10',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block rounded-full bg-white border-2 border-border ring-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-unchecked:translate-x-1',
          size === 'default' && 'h-4.5 w-4.5 data-checked:translate-x-6.5',
          size === 'sm' && 'h-3.5 w-3.5 data-checked:translate-x-4.5'
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
