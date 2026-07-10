// Specimen plates for the live demo. Real photographs (via Lorem Picsum) so the
// image viewer has genuine detail to zoom into — the whole point of the flagship
// component. Each has a small `thumb` for the grid and a large `full` the viewer
// loads on open.

export interface Specimen {
  id: number;
  label: string;
  alt: string;
}

const PICSUM = 'https://picsum.photos/id';

export const thumbUrl = (id: number) => `${PICSUM}/${id}/640/480`;
export const fullUrl = (id: number) => `${PICSUM}/${id}/1800/1350`;

/** The full catalogue — a dozen plates filed in cyanotype. */
export const specimens: Specimen[] = [
  { id: 1039, label: 'Plate I', alt: 'Cyanotype specimen — alpine reservoir' },
  { id: 1043, label: 'Plate II', alt: 'Cyanotype specimen — timber and rail' },
  { id: 1015, label: 'Plate III', alt: 'Cyanotype specimen — river bend' },
  { id: 1018, label: 'Plate IV', alt: 'Cyanotype specimen — ridge line' },
  { id: 1025, label: 'Plate V', alt: 'Cyanotype specimen — study of a hound' },
  { id: 1074, label: 'Plate VI', alt: 'Cyanotype specimen — study of a leopard' },
  { id: 1062, label: 'Plate VII', alt: 'Cyanotype specimen — harvest table' },
  { id: 129, label: 'Plate VIII', alt: 'Cyanotype specimen — desk and instruments' },
  { id: 145, label: 'Plate IX', alt: 'Cyanotype specimen — folded terrain' },
  { id: 164, label: 'Plate X', alt: 'Cyanotype specimen — still water' },
  { id: 142, label: 'Plate XI', alt: 'Cyanotype specimen — quiet street' },
  { id: 1024, label: 'Plate XII', alt: 'Cyanotype specimen — study of a wolf' },
];

/** The image URLs in catalogue order — the carousel set the viewer walks. */
export const specimenFulls = specimens.map((s) => fullUrl(s.id));
