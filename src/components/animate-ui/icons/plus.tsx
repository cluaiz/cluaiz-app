'use client';

import { motion, type Variants } from 'framer-motion';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from './icon';

type PlusProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: {
        rotate: 0,
        transition: { type: 'spring', stiffness: 150, damping: 25 },
      },
      animate: {
        rotate: 90,
        transition: { type: 'spring', stiffness: 150, damping: 25 },
      },
    },
    line1: {},
    line2: {},
  } satisfies Record<string, Variants>,
  rotate: {
    group: {
      initial: {
        rotate: 0,
        transition: { type: 'spring', stiffness: 150, damping: 20 },
      },
      animate: {
        rotate: 90,
        transition: { type: 'spring', stiffness: 150, damping: 20 },
      },
    },
    line1: {},
    line2: {},
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: PlusProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      variants={variants.group}
      initial="initial"
      animate={controls}
      {...props}
    >
      <motion.line
        x1="12"
        y1="5"
        x2="12"
        y2="19"
        variants={variants.line1}
      />
      <motion.line
        x1="5"
        y1="12"
        x2="19"
        y2="12"
        variants={variants.line2}
      />
    </motion.svg>
  );
}

function Plus(props: PlusProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { animations, Plus, Plus as PlusIcon, type PlusProps, type PlusProps as PlusIconProps };
