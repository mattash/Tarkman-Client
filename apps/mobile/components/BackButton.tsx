import type { ComponentProps } from 'react'
import { AppButton } from './AppButton'

/** The shared navigation treatment; the reader can keep its compact chevron. */
export function BackButton({ iconOnly = false, ...props }: Omit<ComponentProps<typeof AppButton>, 'variant' | 'icon'>) {
  return <AppButton {...props} variant="text" icon="back" iconOnly={iconOnly} />
}
