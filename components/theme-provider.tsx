'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Use class attribute so `.dark` class in globals.css is toggled by next-themes
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" {...props}>
      {children}
    </NextThemesProvider>
  )
}
