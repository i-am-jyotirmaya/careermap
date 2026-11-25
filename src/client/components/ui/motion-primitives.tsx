import * as React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export const NEO_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
  mass: 0.85,
};

export const NEO_GENTLE_SPRING = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 28,
};

export const PageTransition: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 12, scale: 0.992 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -8, scale: 0.995 }}
    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

export const StaggerContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}> = ({ children, className, staggerDelay = 0.055 }) => (
  <motion.div
    initial="hidden"
    animate="show"
    variants={{
      hidden: {},
      show: {
        transition: {
          staggerChildren: staggerDelay,
        },
      },
    }}
    className={className}
  >
    {children}
  </motion.div>
);

export const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 14, scale: 0.98 },
      show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: NEO_GENTLE_SPRING,
      },
    }}
    className={className}
  >
    {children}
  </motion.div>
);

export const NeoSelect: React.FC<React.ComponentProps<'select'>> = ({
  className,
  children,
  ...props
}) => (
  <select
    className={cn(
      'h-10 cursor-pointer rounded-base border-2 border-border bg-secondary-background px-3 py-1.5 text-sm font-heading font-bold text-foreground shadow-[2px_2px_0px_0px_var(--border)] transition-all duration-150 focus-visible:outline-none focus-visible:translate-x-[1px] focus-visible:translate-y-[1px] focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-50',
      className
    )}
    {...props}
  >
    {children}
  </select>
);

export const NeoStarBurst: React.FC<{
  className?: string;
  fill?: string;
  size?: number;
}> = ({ className, fill = '#FFDC58', size = 28 }) => (
  <motion.svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    animate={{ rotate: [0, 12, -8, 0] }}
    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    className={cn('shrink-0', className)}
    aria-hidden="true"
  >
    <path
      d="M20 2L24.6 12.1L35.6 9.8L29.7 19.3L38 27.1L26.9 28.4L25.4 39.4L17.7 31.3L7.5 36.2L10.9 25.5L1.5 19.4L11.7 15.1L9.6 4.1L19.1 10.2L20 2Z"
      fill={fill}
      stroke="#000000"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
  </motion.svg>
);
