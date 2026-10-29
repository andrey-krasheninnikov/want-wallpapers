import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Button, Glow } from '@want-foundation/desyst-react';

export function CtaButton({ children, asChild, className, disabled, ...props }: Omit<ComponentProps<typeof Button>, 'ref'>) {
  const host = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState<boolean>();
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let visible = false;
    const update = () => setActive(visible && !document.hidden && document.documentElement.dataset.backgroundMotion === 'running');
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    const motion = new MutationObserver(update);
    visibility.observe(element);
    motion.observe(document.documentElement, { attributes: true, attributeFilter: ['data-background-motion'] });
    document.addEventListener('visibilitychange', update);
    const dispose = () => { visibility.disconnect(); motion.disconnect(); document.removeEventListener('visibilitychange', update); document.removeEventListener('astro:before-swap', dispose); };
    document.addEventListener('astro:before-swap', dispose);
    update();
    return dispose;
  }, []);
  const glow = active === undefined ? null : <Glow key="glow" paused={!active || disabled || props['aria-disabled'] === true || props['aria-disabled'] === 'true' || props['aria-busy'] === true || props['aria-busy'] === 'true'} />;
  const child = asChild ? Children.only(children) : null;
  const content = isValidElement<{ children?: ReactNode }>(child) ? cloneElement(child, undefined, glow, child.props.children) : <>{glow}{children}</>;
  return <Button {...props} ref={host} asChild={asChild} disabled={disabled} className={['glow-host', className].filter(Boolean).join(' ')}>{content}</Button>;
}
