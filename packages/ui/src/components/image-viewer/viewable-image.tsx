import { cn } from '../../lib/utils';

import { useImageViewer } from './image-viewer';
import { ProgressiveImage } from './progressive-image';

/**
 * A clickable image that opens the full-screen {@link ImageViewer} over its
 * whole group, positioned at its own index — so the viewer can be swiped/arrowed
 * as a carousel across the group. Renders a {@link ProgressiveImage} inside.
 */
export function ViewableImage({
  images,
  index,
  thumb,
  full,
  alt,
  className,
  imgClassName,
}: {
  /** The full group of image URLs this one belongs to (the carousel set). */
  images: string[];
  /** This image's position within `images`. */
  index: number;
  thumb?: string;
  full: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const { open } = useImageViewer();
  return (
    <button
      type="button"
      className={cn('viewable-image group', className)}
      onClick={() => open(images, index)}
      aria-label={`Expand: ${alt || `image ${index + 1}`}`}
    >
      <ProgressiveImage
        thumb={thumb}
        full={full}
        alt={alt}
        className="h-full w-full"
        imgClassName={imgClassName}
      />
    </button>
  );
}
