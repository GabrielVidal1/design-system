// @gabvdl/ui — Gabriel Vidal's personal design system.
//
// Tree-shakeable: every component lives in its own module and the package is
// marked side-effect-free (except CSS), so a consumer's bundler keeps only what
// it imports. Styles ship separately — see `@gabvdl/ui/styles.css`.

export { cn } from './lib/utils';

export { ImageViewerProvider, useImageViewer, ViewableImage, ProgressiveImage } from './components/image-viewer';
export { Button } from './components/button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/button';
export { Input } from './components/input';
