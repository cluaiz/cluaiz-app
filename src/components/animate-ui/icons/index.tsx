import * as React from 'react';
import UseAnimations from 'react-useanimations';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  resolveIconSize,
  ICON_SIZE_MAP,
  type IconProps,
  type IconSizeProp,
} from './icon';

// 0. Official Animated Lucide Icons from @animateicons/react
import {
  NotebookPenIcon,
  ArchiveIcon as AnimateArchiveIcon,
  FileArchiveIcon as AnimateFileArchiveIcon,
  ImageIcon as AnimateImageIcon,
  FileIcon as AnimateFileIcon,
  FilesIcon as AnimateFilesIcon,
  FileTextIcon as AnimateFileTextIcon,
  FileCodeIcon as AnimateFileCodeIcon,
  FolderIcon as AnimateFolderIcon,
  FolderOpenIcon as AnimateFolderOpenIcon,
  BookOpenIcon as AnimateBookOpenIcon,
  BookOpenTextIcon as AnimateBookOpenTextIcon,
  PencilIcon as AnimatePencilIcon,
  PenToolIcon as AnimatePenToolIcon,
} from '@animateicons/react/lucide';
import { useIconHover } from '@animateicons/react';

// 1. Local Bespoke Frame-Animated Icons (from animate-ui)
import { Bot, BotIcon } from './bot';
import { BotOff, BotOffIcon } from './bot-off';
import { X, XIcon } from './x';
import { SlidersHorizontal, SlidersHorizontalIcon } from './sliders-horizontal';
import { Search, SearchIcon } from './search';
import { Plus, PlusIcon } from './plus';

// 2. Real Vector Animated Icons from useanimations.com
import activityAnimation from 'react-useanimations/lib/activity';
import archiveAnimation from 'react-useanimations/lib/archive';
import arrowDownAnimation from 'react-useanimations/lib/arrowDown';
import arrowLeftAnimation from 'react-useanimations/lib/arrowLeft';
import arrowRightAnimation from 'react-useanimations/lib/arrowRight';
import arrowUpAnimation from 'react-useanimations/lib/arrowUp';
import bookmarkAnimation from 'react-useanimations/lib/bookmark';
import bookOpenAnimation from 'react-useanimations/lib/bookOpen';
import boxAnimation from 'react-useanimations/lib/box';
import calendarAnimation from 'react-useanimations/lib/calendar';
import checkAnimation from 'react-useanimations/lib/check';
import checkmarkAnimation from 'react-useanimations/lib/checkmark';
import chevronDownAnimation from 'react-useanimations/lib/chevronDown';
import chevronLeftAnimation from 'react-useanimations/lib/chevronLeft';
import chevronRightAnimation from 'react-useanimations/lib/chevronRight';
import chevronUpAnimation from 'react-useanimations/lib/chevronUp';
import clipboardAnimation from 'react-useanimations/lib/clipboard';
import codeAnimation from 'react-useanimations/lib/code';
import copyAnimation from 'react-useanimations/lib/copy';
import downloadAnimation from 'react-useanimations/lib/download';
import editAnimation from 'react-useanimations/lib/edit';
import edit3Animation from 'react-useanimations/lib/edit3';
import exploreAnimation from 'react-useanimations/lib/explore';
import externalLinkAnimation from 'react-useanimations/lib/externalLink';
import fileAnimation from 'react-useanimations/lib/file';
import fileTextAnimation from 'react-useanimations/lib/fileText';
import filterAnimation from 'react-useanimations/lib/filter';
import folderAnimation from 'react-useanimations/lib/folder';
import gitBranchAnimation from 'react-useanimations/lib/gitBranch';
import gridAnimation from 'react-useanimations/lib/grid';
import heartAnimation from 'react-useanimations/lib/heart';
import helpAnimation from 'react-useanimations/lib/help';
import homeAnimation from 'react-useanimations/lib/home';
import infoAnimation from 'react-useanimations/lib/info';
import layersAnimation from 'react-useanimations/lib/layers';
import layoutAnimation from 'react-useanimations/lib/layout';
import linkAnimation from 'react-useanimations/lib/link';
import listAnimation from 'react-useanimations/lib/list';
import lockAnimation from 'react-useanimations/lib/lock';
import mailAnimation from 'react-useanimations/lib/mail';
import maximize2Animation from 'react-useanimations/lib/maximize2';
import menuAnimation from 'react-useanimations/lib/menu';
import messageSquareAnimation from 'react-useanimations/lib/messageSquare';
import microphoneAnimation from 'react-useanimations/lib/microphone';
import minimize2Animation from 'react-useanimations/lib/minimize2';
import moonAnimation from 'react-useanimations/lib/moon';
import moreHorizontalAnimation from 'react-useanimations/lib/moreHorizontal';
import moreVerticalAnimation from 'react-useanimations/lib/moreVertical';
import notificationAnimation from 'react-useanimations/lib/notification';
import packageAnimation from 'react-useanimations/lib/package';
import plusToXAnimation from 'react-useanimations/lib/plusToX';
import rotateCcwAnimation from 'react-useanimations/lib/rotateCcw';
import rotateCwAnimation from 'react-useanimations/lib/rotateCw';
import searchToXAnimation from 'react-useanimations/lib/searchToX';
import sendAnimation from 'react-useanimations/lib/send';
import settingsAnimation from 'react-useanimations/lib/settings';
import shareAnimation from 'react-useanimations/lib/share';
import sidebarAnimation from 'react-useanimations/lib/sidebar';
import starAnimation from 'react-useanimations/lib/star';
import sunAnimation from 'react-useanimations/lib/sun';
import toolAnimation from 'react-useanimations/lib/tool';
import trash2Animation from 'react-useanimations/lib/trash2';
import uploadCloudAnimation from 'react-useanimations/lib/uploadCloud';
import visibilityAnimation from 'react-useanimations/lib/visibility';
import volumeAnimation from 'react-useanimations/lib/volume';

// Helper to create real vector animated icon components with default hover interaction and imperative ref triggers
function createUseAnimationIcon(animationData: any, defaultInteraction: any = 'hover'): React.ForwardRefExoticComponent<any> {
  const UseAnimatedIcon = React.forwardRef<any, IconProps>((props, ref) => {
    const { size, className = '', ...rest } = props;
    const rawSize = resolveIconSize(size, className);
    // Vector animations have intrinsic canvas padding, maintain at least 16px to prevent collapse
    const resolvedSize = Math.max(16, rawSize);
    const interaction = (rest as any).interaction || defaultInteraction || 'hover';

    const triggerAnimRef = React.useRef<{ start: () => void; stop: () => void }>({
      start: () => {},
      stop: () => {},
    });

    React.useImperativeHandle(
      ref,
      () => ({
        startAnimation: () => {
          triggerAnimRef.current.start();
        },
        stopAnimation: () => {
          triggerAnimRef.current.stop();
        },
      }),
      []
    );

    return (
      <span className={cn('inline-flex items-center justify-center shrink-0 select-none leading-none', className)}>
        <UseAnimations
          animation={animationData}
          size={resolvedSize}
          strokeColor="currentColor"
          interaction={interaction}
          render={(eventProps, animationProps) => {
            triggerAnimRef.current.start = () => eventProps.onMouseEnter({ defaultPrevented: false } as any);
            triggerAnimRef.current.stop = () => eventProps.onMouseLeave({ defaultPrevented: false } as any);
            return (
              <span
                {...animationProps}
                {...eventProps}
              />
            );
          }}
          {...(rest as any)}
        />
      </span>
    );
  });
  UseAnimatedIcon.displayName = 'UseAnimatedIcon';
  return UseAnimatedIcon;
}

// Clean fallback wrapper for icons without dedicated vector animation with safe ref forwarding
function wrapLucideIcon(Component: LucideIcon): React.ForwardRefExoticComponent<any> {
  const PureIcon = React.forwardRef<any, IconProps>((props, ref) => {
    const { size, className = '', strokeWidth = 2, ...rest } = props;
    const resolvedSize = resolveIconSize(size, className);

    React.useImperativeHandle(
      ref,
      () => ({
        startAnimation: () => {},
        stopAnimation: () => {},
      }),
      []
    );

    return (
      <Component
        size={resolvedSize}
        strokeWidth={strokeWidth}
        className={className}
        {...(rest as any)}
      />
    );
  });
  PureIcon.displayName = Component.displayName || Component.name || 'PureIcon';
  return PureIcon;
}

// Helper to wrap @animateicons/react animated components with consistent sizing and ref forwarding
export function createAnimateIconsIcon(Component: React.ComponentType<any>): React.ForwardRefExoticComponent<any> {
  const AnimateIconWrapped = React.forwardRef<any, IconProps & { duration?: number; isAnimated?: boolean; color?: string }>(
    ({ size, className = '', duration = 1, isAnimated = true, color = 'currentColor', ...props }, ref) => {
      const resolvedSize = resolveIconSize(size, className);
      return (
        <Component
          ref={ref}
          size={resolvedSize}
          duration={duration}
          isAnimated={isAnimated}
          color={color}
          className={cn('inline-flex items-center justify-center shrink-0 select-none leading-none', className)}
          {...props}
        />
      );
    }
  );
  AnimateIconWrapped.displayName = Component.displayName || Component.name || 'AnimateIcon';
  return AnimateIconWrapped;
}

// 3. Central Real Animated Vector Icons Registry
export const SearchToX = createUseAnimationIcon(searchToXAnimation);
export const Settings = createUseAnimationIcon(settingsAnimation);
export const FolderKanban = createUseAnimationIcon(layersAnimation);
export const Trash = createUseAnimationIcon(trash2Animation);
export const Trash2 = createUseAnimationIcon(trash2Animation);
export const Check = createUseAnimationIcon(checkmarkAnimation);
export const Checkmark = createUseAnimationIcon(checkmarkAnimation);
export const Menu = createUseAnimationIcon(menuAnimation);
export const Sidebar = createUseAnimationIcon(sidebarAnimation);
export const MessageSquare = createUseAnimationIcon(messageSquareAnimation);
export const PlusToX = createUseAnimationIcon(plusToXAnimation);
export const Copy = createUseAnimationIcon(copyAnimation);
export const Edit = createUseAnimationIcon(editAnimation);
export const Edit3 = createUseAnimationIcon(edit3Animation);
export const Bookmark = createUseAnimationIcon(bookmarkAnimation);
export const Visibility = createUseAnimationIcon(visibilityAnimation);
export const Eye = createUseAnimationIcon(visibilityAnimation);
export const ArrowLeft = createUseAnimationIcon(arrowLeftAnimation);
export const ArrowRight = createUseAnimationIcon(arrowRightAnimation);
export const ArrowDown = createUseAnimationIcon(arrowDownAnimation);
export const ArrowUp = createUseAnimationIcon(arrowUpAnimation);
export const ArrowUpDown = createUseAnimationIcon(arrowDownAnimation);
export const ChevronRight = createUseAnimationIcon(chevronRightAnimation);
export const ChevronLeft = createUseAnimationIcon(chevronLeftAnimation);
export const ChevronDown = createUseAnimationIcon(chevronDownAnimation);
export const ChevronUp = createUseAnimationIcon(chevronUpAnimation);
export const LayoutGrid = wrapLucideIcon(LucideIcons.LayoutGrid);
export const Grid = wrapLucideIcon(LucideIcons.Grid);
export const List = wrapLucideIcon(LucideIcons.List);
export const Layers = createUseAnimationIcon(layersAnimation);
export const Activity = createUseAnimationIcon(activityAnimation);
export const Calendar = createUseAnimationIcon(calendarAnimation);
export const Clipboard = createUseAnimationIcon(clipboardAnimation);
export const Lock = createUseAnimationIcon(lockAnimation);
export const Share = createUseAnimationIcon(shareAnimation);
export const Share2 = createUseAnimationIcon(shareAnimation);
export const Info = createUseAnimationIcon(infoAnimation);
export const Help = createUseAnimationIcon(helpAnimation);
export const HelpCircle = createUseAnimationIcon(helpAnimation);
export const Download = createUseAnimationIcon(downloadAnimation);
export const UploadCloud = createUseAnimationIcon(uploadCloudAnimation);
export const Star = createUseAnimationIcon(starAnimation);
export const Sun = createUseAnimationIcon(sunAnimation);
export const Moon = createUseAnimationIcon(moonAnimation);
export const MoreHorizontal = createUseAnimationIcon(moreHorizontalAnimation);
export const MoreVertical = createUseAnimationIcon(moreVerticalAnimation);
export const Notification = createUseAnimationIcon(notificationAnimation);
export const Bell = createUseAnimationIcon(notificationAnimation);
export const RotateCw = createUseAnimationIcon(rotateCwAnimation);
export const RotateCcw = createUseAnimationIcon(rotateCcwAnimation);
export const Send = createUseAnimationIcon(sendAnimation);
export const Volume = createUseAnimationIcon(volumeAnimation);
export const Filter = createUseAnimationIcon(filterAnimation);
export const Heart = createUseAnimationIcon(heartAnimation);
export const Home = createUseAnimationIcon(homeAnimation);
export const Link = createUseAnimationIcon(linkAnimation);
export const Mail = createUseAnimationIcon(mailAnimation);
export const Maximize = createUseAnimationIcon(maximize2Animation);
export const Minimize = createUseAnimationIcon(minimize2Animation);
export const Microphone = createUseAnimationIcon(microphoneAnimation);

// Real Vector Animated Icons for Dock and Workspace
export const Tool = createUseAnimationIcon(toolAnimation);
export const Wrench = createUseAnimationIcon(toolAnimation);
export const Code = createUseAnimationIcon(codeAnimation);
export const Code2 = createUseAnimationIcon(codeAnimation);
export const Box = createUseAnimationIcon(boxAnimation);
export const Boxes = createUseAnimationIcon(packageAnimation);
export const Package = createUseAnimationIcon(packageAnimation);
export const GitBranch = createUseAnimationIcon(gitBranchAnimation);
export const FolderGit2 = createUseAnimationIcon(gitBranchAnimation);
// Official Animated Lucide Icons (Built on motion/react with parent ref & hover support)
export const NotebookPen = createAnimateIconsIcon(NotebookPenIcon);
export const Notebook = NotebookPen;
export const Archive = createAnimateIconsIcon(AnimateArchiveIcon);
export const FileArchive = createAnimateIconsIcon(AnimateFileArchiveIcon);
export const FolderArchive = createAnimateIconsIcon(AnimateFileArchiveIcon);
export const Image = createAnimateIconsIcon(AnimateImageIcon);
export const ImageIcon = Image;
export const Gallery = Image;
export const Media = Image;
export const File = createAnimateIconsIcon(AnimateFileIcon);
export const Files = createAnimateIconsIcon(AnimateFilesIcon);
export const FileText = createAnimateIconsIcon(AnimateFileTextIcon);
export const FileCode = createAnimateIconsIcon(AnimateFileCodeIcon);
export const Folder = createAnimateIconsIcon(AnimateFolderIcon);
export const FolderOpen = createAnimateIconsIcon(AnimateFolderOpenIcon);
export const BookOpen = createAnimateIconsIcon(AnimateBookOpenIcon);
export const BookOpenText = createAnimateIconsIcon(AnimateBookOpenTextIcon);
export const Pencil = createAnimateIconsIcon(AnimatePencilIcon);
export const PenTool = createAnimateIconsIcon(AnimatePenToolIcon);

export { useIconHover };

export {
  Search,
  SearchIcon,
  Plus,
  PlusIcon,
  Bot,
  BotIcon,
  BotOff,
  BotOffIcon,
  X,
  XIcon,
  SlidersHorizontal,
  SlidersHorizontalIcon,
  ICON_SIZE_MAP,
  resolveIconSize,
  type IconProps,
  type IconSizeProp,
};

// 4. Registry Map for Direct & Proxy Lookup
const bespokeRegistry: Record<string, React.ComponentType<any>> = {
  Search: Search as any,
  SearchIcon: SearchIcon as any,
  SearchToX: SearchToX as any,
  Plus: Plus as any,
  PlusIcon: PlusIcon as any,
  PlusToX: PlusToX as any,
  Settings,
  FolderKanban,
  Trash,
  Trash2,
  Check,
  Checkmark,
  Menu,
  Sidebar,
  MessageSquare,
  Copy,
  Edit,
  Edit3,
  Bookmark,
  Visibility,
  Eye,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Grid,
  List,
  Layers,
  Activity,
  Calendar,
  Clipboard,
  Lock,
  Share,
  Share2,
  Info,
  Help,
  HelpCircle,
  Download,
  UploadCloud,
  Star,
  Sun,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Notification,
  Bell,
  RotateCw,
  RotateCcw,
  Send,
  Volume,
  Filter,
  Heart,
  Home,
  Link,
  Mail,
  Maximize,
  Minimize,
  Microphone,
  Tool,
  Wrench,
  Code,
  Code2,
  Box,
  Boxes,
  Package,
  GitBranch,
  FolderGit2,
  NotebookPen: NotebookPen as any,
  Notebook: Notebook as any,
  Archive: Archive as any,
  FileArchive: FileArchive as any,
  FolderArchive: FolderArchive as any,
  Image: Image as any,
  ImageIcon: ImageIcon as any,
  Gallery: Gallery as any,
  Media: Media as any,
  File: File as any,
  Files: Files as any,
  FileText: FileText as any,
  FileCode: FileCode as any,
  BookOpen: BookOpen as any,
  BookOpenText: BookOpenText as any,
  Pencil: Pencil as any,
  PenTool: PenTool as any,
  Bot: Bot as any,
  BotIcon: BotIcon as any,
  BotOff: BotOff as any,
  BotOffIcon: BotOffIcon as any,
  X: X as any,
  XIcon: XIcon as any,
  SlidersHorizontal: SlidersHorizontal as any,
  SlidersHorizontalIcon: SlidersHorizontalIcon as any,
};

// 5. Cached Registry for any remaining Lucide Icons
const iconCache = new Map<string, React.ComponentType<any>>();

export type IconComponent = React.ComponentType<any>;
export type IconsType = {
  [K in keyof typeof LucideIcons]: IconComponent;
} & typeof bespokeRegistry;

// 6. Unified Single Source of Truth Proxy
export const Icons: IconsType = new Proxy({} as IconsType, {
  get(_target, prop: string) {
    if (prop in bespokeRegistry) {
      return bespokeRegistry[prop];
    }
    if (iconCache.has(prop)) {
      return iconCache.get(prop);
    }
    const LucideComponent = (LucideIcons as any)[prop];
    if (typeof LucideComponent === 'function' || typeof LucideComponent === 'object') {
      const wrapped = wrapLucideIcon(LucideComponent);
      iconCache.set(prop, wrapped);
      return wrapped;
    }
    return undefined;
  },
});

export const Icon = Icons;
export default Icons;
