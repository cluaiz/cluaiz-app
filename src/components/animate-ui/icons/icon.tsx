'use client';

import * as React from 'react';
import {
  motion,
  useAnimation,
  type SVGMotionProps,
  type UseInViewOptions,
  type LegacyAnimationControls,
  type Variants,
  type HTMLMotionProps,
} from 'framer-motion';

import { cn } from '../../../lib/utils';
import { useIsInView } from '../../../hooks/use-is-in-view';
import { Slot, type WithAsChild } from '../primitives/animate/slot';

const staticAnimations = {
  path: {
    initial: { pathLength: 1 },
    animate: {
      pathLength: [0.05, 1],
      transition: {
        duration: 0.8,
        ease: 'easeInOut',
      },
    },
  } as Variants,
  'path-loop': {
    initial: { pathLength: 1 },
    animate: {
      pathLength: [1, 0.05, 1],
      transition: {
        duration: 1.6,
        ease: 'easeInOut',
      },
    },
  } as Variants,
} as const;

type StaticAnimations = keyof typeof staticAnimations;
type TriggerProp<T = string> = boolean | StaticAnimations | T;
type Trigger = TriggerProp<string>;

type AnimateIconContextValue = {
  controls: LegacyAnimationControls | undefined;
  animation: StaticAnimations | string;
  loop: boolean;
  loopDelay: number;
  active: boolean;
  animate?: Trigger;
  initialOnAnimateEnd?: boolean;
  completeOnStop?: boolean;
  persistOnAnimateEnd?: boolean;
  delay?: number;
};

type DefaultIconProps<T = string> = {
  animate?: TriggerProp<T>;
  animateOnHover?: TriggerProp<T>;
  animateOnTap?: TriggerProp<T>;
  animateOnView?: TriggerProp<T>;
  animateOnViewMargin?: UseInViewOptions['margin'];
  animateOnViewOnce?: boolean;
  animation?: T | StaticAnimations;
  loop?: boolean;
  loopDelay?: number;
  initialOnAnimateEnd?: boolean;
  completeOnStop?: boolean;
  persistOnAnimateEnd?: boolean;
  delay?: number;
};

type AnimateIconProps<T = string> = WithAsChild<
  HTMLMotionProps<'span'> &
    DefaultIconProps<T> & {
      children: React.ReactNode;
      asChild?: boolean;
    }
>;

const ICON_SIZE_MAP = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
} as const;

type IconSizeProp = number | keyof typeof ICON_SIZE_MAP;

function resolveIconSize(size?: IconSizeProp, className?: any): number {
  if (typeof size === 'number') return size;
  if (size && size in ICON_SIZE_MAP) return ICON_SIZE_MAP[size as keyof typeof ICON_SIZE_MAP];

  if (typeof className === 'string') {
    if (className.includes('w-8') || className.includes('h-8')) return 32;
    if (className.includes('w-7') || className.includes('h-7')) return 28;
    if (className.includes('w-6') || className.includes('h-6')) return 24;
    if (className.includes('w-5') || className.includes('h-5')) return 20;
    if (className.includes('w-4.5') || className.includes('h-4.5')) return 18;
    if (className.includes('w-4') || className.includes('h-4')) return 16;
    if (className.includes('w-3.5') || className.includes('h-3.5')) return 14;
    if (className.includes('w-3') || className.includes('h-3')) return 12;
  }

  return ICON_SIZE_MAP.md;
}

type IconProps<T = string> = DefaultIconProps<T> &
  Omit<SVGMotionProps<SVGSVGElement>, 'animate'> & {
    size?: IconSizeProp;
  };

type IconWrapperProps<T = string> = IconProps<T> & {
  icon: React.ComponentType<any>;
};

const AnimateIconContext = React.createContext<AnimateIconContextValue | null>(
  null,
);

function useAnimateIconContext() {
  const context = React.useContext(AnimateIconContext);
  if (!context)
    return {
      controls: undefined,
      animation: 'default',
      loop: undefined,
      loopDelay: undefined,
      active: undefined,
      animate: undefined,
      initialOnAnimateEnd: undefined,
      completeOnStop: undefined,
      persistOnAnimateEnd: undefined,
      delay: undefined,
    };
  return context;
}

function composeEventHandlers<E extends React.SyntheticEvent<unknown>>(
  theirs?: (event: E) => void,
  ours?: (event: E) => void,
) {
  return (event: E) => {
    theirs?.(event);
    ours?.(event);
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

const AnimateIcon = React.forwardRef<any, AnimateIconProps>(function AnimateIcon({
  asChild = false,
  animate = false,
  animateOnHover = false,
  animateOnTap = false,
  animateOnView = false,
  animateOnViewMargin = '0px',
  animateOnViewOnce = true,
  animation = 'default',
  loop = false,
  loopDelay = 0,
  initialOnAnimateEnd = false,
  completeOnStop = false,
  persistOnAnimateEnd = false,
  delay = 0,
  children,
  ...props
}: AnimateIconProps, ref) {
  const controls = useAnimation();

  const [localAnimate, setLocalAnimate] = React.useState<boolean>(() => {
    if (animate === undefined || animate === false) return false;
    return delay <= 0;
  });
  const [currentAnimation, setCurrentAnimation] = React.useState<
    string | StaticAnimations
  >(typeof animate === 'string' ? animate : animation);
  const [status, setStatus] = React.useState<'initial' | 'animate'>('initial');

  const delayRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopDelayRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnimateInProgressRef = React.useRef<boolean>(false);
  const animateEndPromiseRef = React.useRef<Promise<void> | null>(null);
  const resolveAnimateEndRef = React.useRef<(() => void) | null>(null);
  const activeRef = React.useRef<boolean>(localAnimate);

  const runGenRef = React.useRef(0);
  const cancelledRef = React.useRef(false);

  const bumpGeneration = React.useCallback(() => {
    runGenRef.current++;
  }, []);

  const startAnimation = React.useCallback(
    (trigger: TriggerProp) => {
      const next = typeof trigger === 'string' ? trigger : animation;
      bumpGeneration();
      if (delayRef.current) {
        clearTimeout(delayRef.current);
        delayRef.current = null;
      }
      setCurrentAnimation(next);
      if (delay > 0) {
        setLocalAnimate(false);
        delayRef.current = setTimeout(() => {
          setLocalAnimate(true);
        }, delay);
      } else {
        setLocalAnimate(true);
      }
    },
    [animation, delay, bumpGeneration],
  );

  const stopAnimation = React.useCallback(() => {
    bumpGeneration();
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (loopDelayRef.current) {
      clearTimeout(loopDelayRef.current);
      loopDelayRef.current = null;
    }
    setLocalAnimate(false);
  }, [bumpGeneration]);

  React.useImperativeHandle(
    ref,
    () => ({
      startAnimation: (trigger: TriggerProp = true) => {
        startAnimation(trigger);
      },
      stopAnimation: () => {
        stopAnimation();
      },
    }),
    [startAnimation, stopAnimation],
  );

  React.useEffect(() => {
    activeRef.current = localAnimate;
  }, [localAnimate]);

  React.useEffect(() => {
    if (animate === undefined) return;
    setCurrentAnimation(typeof animate === 'string' ? animate : animation);
    if (animate) startAnimation(animate as TriggerProp);
    else stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  React.useEffect(() => {
    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
      if (loopDelayRef.current) clearTimeout(loopDelayRef.current);
    };
  }, []);

  const viewOuterRef = React.useRef<HTMLElement>(null);
  const { ref: inViewRef, isInView } = useIsInView(viewOuterRef, {
    inView: !!animateOnView,
    inViewOnce: animateOnViewOnce,
    inViewMargin: animateOnViewMargin,
  });

  const startAnim = React.useCallback(
    async (anim: 'initial' | 'animate', method: 'start' | 'set' = 'start') => {
      try {
        await controls[method](anim);
        setStatus(anim);
      } catch {
        return;
      }
    },
    [controls],
  );

  React.useEffect(() => {
    if (!animateOnView) return;
    if (isInView) startAnimation(animateOnView);
    else stopAnimation();
  }, [isInView, animateOnView, startAnimation, stopAnimation]);

  React.useEffect(() => {
    const gen = ++runGenRef.current;
    cancelledRef.current = false;

    async function run() {
      if (cancelledRef.current || gen !== runGenRef.current) {
        await startAnim('initial');
        return;
      }

      if (!localAnimate) {
        if (
          completeOnStop &&
          isAnimateInProgressRef.current &&
          animateEndPromiseRef.current
        ) {
          try {
            await animateEndPromiseRef.current;
          } catch {
            // noop
          }
        }
        if (!persistOnAnimateEnd) {
          if (cancelledRef.current || gen !== runGenRef.current) {
            await startAnim('initial');
            return;
          }
          await startAnim('initial');
        }
        return;
      }

      if (loop) {
        if (cancelledRef.current || gen !== runGenRef.current) {
          await startAnim('initial');
          return;
        }
        await startAnim('initial', 'set');
      }

      isAnimateInProgressRef.current = true;
      animateEndPromiseRef.current = new Promise<void>((resolve) => {
        resolveAnimateEndRef.current = resolve;
      });

      if (cancelledRef.current || gen !== runGenRef.current) {
        isAnimateInProgressRef.current = false;
        resolveAnimateEndRef.current?.();
        resolveAnimateEndRef.current = null;
        animateEndPromiseRef.current = null;
        await startAnim('initial');
        return;
      }

      await startAnim('animate');

      if (cancelledRef.current || gen !== runGenRef.current) {
        isAnimateInProgressRef.current = false;
        resolveAnimateEndRef.current?.();
        resolveAnimateEndRef.current = null;
        animateEndPromiseRef.current = null;
        await startAnim('initial');
        return;
      }

      isAnimateInProgressRef.current = false;
      resolveAnimateEndRef.current?.();
      resolveAnimateEndRef.current = null;
      animateEndPromiseRef.current = null;

      if (initialOnAnimateEnd) {
        if (cancelledRef.current || gen !== runGenRef.current) {
          await startAnim('initial');
          return;
        }
        await startAnim('initial', 'set');
      }

      if (loop) {
        if (loopDelay > 0) {
          await new Promise<void>((resolve) => {
            loopDelayRef.current = setTimeout(() => {
              loopDelayRef.current = null;
              resolve();
            }, loopDelay);
          });

          if (cancelledRef.current || gen !== runGenRef.current) {
            await startAnim('initial');
            return;
          }
          if (!activeRef.current) {
            if (status !== 'initial' && !persistOnAnimateEnd)
              await startAnim('initial');
            return;
          }
        } else {
          if (!activeRef.current) {
            if (status !== 'initial' && !persistOnAnimateEnd)
              await startAnim('initial');
            return;
          }
        }
        if (cancelledRef.current || gen !== runGenRef.current) {
          await startAnim('initial');
          return;
        }
        await run();
      }
    }

    void run();

    return () => {
      cancelledRef.current = true;
      if (delayRef.current) {
        clearTimeout(delayRef.current);
        delayRef.current = null;
      }
      if (loopDelayRef.current) {
        clearTimeout(loopDelayRef.current);
        loopDelayRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localAnimate, controls]);

  const childProps = (
    React.isValidElement(children) ? (children as React.ReactElement).props : {}
  ) as AnyProps;

  const handleMouseEnter = composeEventHandlers<React.MouseEvent<HTMLElement>>(
    childProps.onMouseEnter,
    () => {
      if (animateOnHover) startAnimation(animateOnHover);
    },
  );

  const handleMouseLeave = composeEventHandlers<React.MouseEvent<HTMLElement>>(
    childProps.onMouseLeave,
    () => {
      if (animateOnHover || animateOnTap) stopAnimation();
    },
  );

  const handlePointerDown = composeEventHandlers<
    React.PointerEvent<HTMLElement>
  >(childProps.onPointerDown, () => {
    if (animateOnTap) startAnimation(animateOnTap);
  });

  const handlePointerUp = composeEventHandlers<React.PointerEvent<HTMLElement>>(
    childProps.onPointerUp,
    () => {
      if (animateOnTap) stopAnimation();
    },
  );

  const content = asChild ? (
    <Slot
      ref={inViewRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      {...props}
    >
      {children}
    </Slot>
  ) : (
    <motion.span
      ref={inViewRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      {...props}
    >
      {children}
    </motion.span>
  );

  return (
    <AnimateIconContext.Provider
      value={{
        controls,
        animation: currentAnimation,
        loop,
        loopDelay,
        active: localAnimate,
        animate,
        initialOnAnimateEnd,
        completeOnStop,
        delay,
      }}
    >
      {content}
    </AnimateIconContext.Provider>
  );
});

const pathClassName =
  "[&_[stroke-dasharray='1px_1px']]:![stroke-dasharray:1px_0px]";

const IconWrapper = React.forwardRef<any, IconWrapperProps<any>>(function IconWrapper(
  {
    animate,
    animateOnHover = true,
    animateOnTap,
    animateOnView,
    animateOnViewMargin,
    animateOnViewOnce,
    animation: animationProp,
    icon: IconComponent,
    loop,
    loopDelay,
    persistOnAnimateEnd,
    initialOnAnimateEnd,
    delay,
    completeOnStop,
    className,
    size,
    ...props
  }: IconWrapperProps<any>,
  ref: any
) {
  const resolvedSize = resolveIconSize(size, className);
  const context = React.useContext(AnimateIconContext);

  if (context) {
    const {
      controls,
      animation: parentAnimation,
      loop: parentLoop,
      loopDelay: parentLoopDelay,
      active: parentActive,
      animate: parentAnimate,
      persistOnAnimateEnd: parentPersistOnAnimateEnd,
      initialOnAnimateEnd: parentInitialOnAnimateEnd,
      delay: parentDelay,
      completeOnStop: parentCompleteOnStop,
    } = context;

    const hasOverrides =
      animate !== undefined ||
      animateOnHover !== undefined ||
      animateOnTap !== undefined ||
      animateOnView !== undefined ||
      loop !== undefined ||
      loopDelay !== undefined ||
      initialOnAnimateEnd !== undefined ||
      persistOnAnimateEnd !== undefined ||
      delay !== undefined ||
      completeOnStop !== undefined;

    if (hasOverrides) {
      const inheritedAnimate: Trigger = parentActive
        ? (animationProp ?? parentAnimation ?? 'default')
        : false;

      const finalAnimate: Trigger = (animate ??
        parentAnimate ??
        inheritedAnimate) as Trigger;

      return (
        <AnimateIcon
          animate={finalAnimate}
          animateOnHover={animateOnHover}
          animateOnTap={animateOnTap}
          animateOnView={animateOnView}
          animateOnViewMargin={animateOnViewMargin}
          animateOnViewOnce={animateOnViewOnce}
          animation={animationProp ?? parentAnimation}
          loop={loop ?? parentLoop}
          loopDelay={loopDelay ?? parentLoopDelay}
          persistOnAnimateEnd={persistOnAnimateEnd ?? parentPersistOnAnimateEnd}
          initialOnAnimateEnd={initialOnAnimateEnd ?? parentInitialOnAnimateEnd}
          delay={delay ?? parentDelay}
          completeOnStop={completeOnStop ?? parentCompleteOnStop}
          asChild
        >
          <IconComponent
            size={resolvedSize}
            className={cn(
              className,
              ((animationProp ?? parentAnimation) === 'path' ||
                (animationProp ?? parentAnimation) === 'path-loop') &&
                pathClassName,
            )}
            {...props}
          />
        </AnimateIcon>
      );
    }

    const animationToUse = animationProp ?? parentAnimation;
    const loopToUse = parentLoop;
    const loopDelayToUse = parentLoopDelay;

    return (
      <AnimateIconContext.Provider
        value={{
          controls,
          animation: animationToUse,
          loop: loopToUse,
          loopDelay: loopDelayToUse,
          active: parentActive,
          animate: parentAnimate,
          initialOnAnimateEnd: parentInitialOnAnimateEnd,
          delay: parentDelay,
          completeOnStop: parentCompleteOnStop,
        }}
      >
        <IconComponent
          size={resolvedSize}
          className={cn(
            className,
            (animationToUse === 'path' || animationToUse === 'path-loop') &&
              pathClassName,
          )}
          {...props}
        />
      </AnimateIconContext.Provider>
    );
  }

  const shouldAnimateOnHover = animateOnHover ?? true;

  if (
    animate !== undefined ||
    shouldAnimateOnHover ||
    animateOnTap !== undefined ||
    animateOnView !== undefined ||
    animationProp !== undefined
  ) {
    return (
      <AnimateIcon
        ref={ref}
        animate={animate}
        animateOnHover={shouldAnimateOnHover}
        animateOnTap={animateOnTap}
        animateOnView={animateOnView}
        animateOnViewMargin={animateOnViewMargin}
        animateOnViewOnce={animateOnViewOnce}
        animation={animationProp}
        loop={loop}
        loopDelay={loopDelay}
        delay={delay}
        completeOnStop={completeOnStop}
        asChild
      >
        <IconComponent
          size={resolvedSize}
          className={cn(
            className,
            (animationProp === 'path' || animationProp === 'path-loop') &&
              pathClassName,
          )}
          {...props}
        />
      </AnimateIcon>
    );
  }

  return (
    <IconComponent
      size={resolvedSize}
      className={cn(
        className,
        (animationProp === 'path' || animationProp === 'path-loop') &&
          pathClassName,
      )}
      {...props}
    />
  );
});

function getVariants<
  V extends { default: any; [key: string]: any }
>(animations: V): any {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { animation: animationType } = useAnimateIconContext();

  let result: any;

  if (animationType in staticAnimations) {
    const variant = staticAnimations[animationType as StaticAnimations];
    result = {};
    for (const key in animations.default) {
      if (
        (animationType === 'path' || animationType === 'path-loop') &&
        key.includes('group')
      )
        continue;
      result[key] = variant;
    }
  } else {
    result = animations[animationType as keyof V] ?? animations.default;
  }

  return result;
}

export {
  pathClassName,
  staticAnimations,
  AnimateIcon,
  IconWrapper,
  useAnimateIconContext,
  getVariants,
  ICON_SIZE_MAP,
  resolveIconSize,
  type IconSizeProp,
  type IconProps,
  type IconWrapperProps,
  type AnimateIconProps,
  type AnimateIconContextValue,
};
