import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-base border-2 border-border px-2.5 py-0.5 text-xs font-heading font-bold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none shadow-[2px_2px_0px_0px_var(--border)] transition-transform duration-150',
  {
    variants: {
      variant: {
        default: 'bg-main text-main-foreground',
        neutral: 'bg-secondary-background text-foreground',
        yellow: 'bg-[#FFDC58] text-black',
        mint: 'bg-[#05E17A] text-black',
        violet: 'bg-[#A985FF] text-black',
        coral: 'bg-[#FF6B6B] text-black',
        cyan: 'bg-[#22D3EE] text-black',
        dark: 'bg-black text-white shadow-none',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({
  className,
  variant,
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    render,
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    state: {
      slot: 'badge',
      variant: variant ?? 'default',
    },
  });
}

export { Badge, badgeVariants };
