import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-base text-sm font-heading font-bold ring-offset-white transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] gap-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'text-main-foreground bg-main border-2 border-border shadow-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_var(--border)] active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none',
        neutral:
          'bg-secondary-background text-foreground border-2 border-border shadow-shadow hover:bg-background hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_var(--border)] active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none',
        reverse:
          'text-main-foreground bg-main border-2 border-border hover:translate-x-reverseBoxShadowX hover:translate-y-reverseBoxShadowY hover:shadow-shadow active:translate-x-0 active:translate-y-0 active:shadow-none',
        noShadow:
          'text-main-foreground bg-main border-2 border-border hover:brightness-95 active:scale-[0.98]',
        yellow:
          'text-black bg-[#FFDC58] border-2 border-border shadow-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_var(--border)] active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none',
        mint:
          'text-black bg-[#05E17A] border-2 border-border shadow-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_var(--border)] active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none',
        violet:
          'text-black bg-[#A985FF] border-2 border-border shadow-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_var(--border)] active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none',
        danger:
          'text-black bg-[#FF6B6B] border-2 border-border shadow-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_var(--border)] active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none',
      },
      size: {
        default: 'h-10 px-4 py-2',
        xs: 'h-8 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ButtonPrimitive> & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
