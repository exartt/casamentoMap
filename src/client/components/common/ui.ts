export const btn = {
  base: 'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 [@media(pointer:coarse)]:min-h-[40px]',
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50',
  ghost: 'text-gray-700 hover:bg-gray-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  small: 'px-2 py-1 text-xs',
  icon: 'h-8 w-8 p-0 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10',
} as const;

export const input =
  'w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-base text-gray-900 sm:text-sm [@media(pointer:coarse)]:py-2 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-100';

export const label = 'block text-xs font-medium text-gray-600 mb-1';

export const checkbox = 'h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500';

export const select = input;

/** Joins class names, ignoring falsy values. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
