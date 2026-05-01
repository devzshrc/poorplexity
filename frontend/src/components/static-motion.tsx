import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { joinClasses } from '@/lib/format'

export const fadeUp = { className: 'anim-fade-up' }
export const subtleList = { className: '' }
export const fadeScale = { className: 'anim-scale-in' }

type StaticMotionProps = {
  initial?: unknown
  animate?: unknown
  exit?: unknown
  transition?: unknown
  variants?: unknown
  whileHover?: unknown
  whileTap?: unknown
  layout?: unknown
}

function pickAnim(variants: unknown, fallback: string): string {
  if (variants && typeof variants === 'object' && 'className' in variants) {
    const value = (variants as { className?: unknown }).className
    if (typeof value === 'string') return value
  }
  return fallback
}

function StaticMotionDiv({
  initial: _initial,
  animate: _animate,
  exit: _exit,
  transition: _transition,
  variants,
  whileHover: _whileHover,
  whileTap: _whileTap,
  layout: _layout,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'> & StaticMotionProps) {
  const anim = pickAnim(variants, 'anim-fade-in')
  return <div className={joinClasses(anim, className)} {...props} />
}

function StaticMotionSection({
  initial: _initial,
  animate: _animate,
  exit: _exit,
  transition: _transition,
  variants,
  whileHover: _whileHover,
  whileTap: _whileTap,
  layout: _layout,
  className,
  ...props
}: ComponentPropsWithoutRef<'section'> & StaticMotionProps) {
  const anim = pickAnim(variants, 'anim-fade-up')
  return <section className={joinClasses(anim, className)} {...props} />
}

function StaticMotionButton({
  initial: _initial,
  animate: _animate,
  exit: _exit,
  transition: _transition,
  variants: _variants,
  whileHover: _whileHover,
  whileTap: _whileTap,
  layout: _layout,
  ...props
}: ComponentPropsWithoutRef<'button'> & StaticMotionProps) {
  return <button {...props} />
}

function StaticMotionAnchor({
  initial: _initial,
  animate: _animate,
  exit: _exit,
  transition: _transition,
  variants: _variants,
  whileHover: _whileHover,
  whileTap: _whileTap,
  layout: _layout,
  ...props
}: ComponentPropsWithoutRef<'a'> & StaticMotionProps) {
  return <a {...props} />
}

export const AnimatePresence = ({ children }: { children: ReactNode }) => <>{children}</>

export const motion = {
  a: StaticMotionAnchor,
  button: StaticMotionButton,
  div: StaticMotionDiv,
  section: StaticMotionSection,
}
