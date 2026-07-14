// Specimen plates for the live demo. Real photographs (via Lorem Picsum) so the
// image viewer has genuine detail to zoom into — the whole point of the flagship
// component. Each has a small `thumb` for the grid and a large `full` the viewer
// loads on open.

import type { ViewerMedia } from '@gabvdl/ui';

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

/**
 * A story reel: the same plates, plus a clip, as the `ViewerMedia` slides the
 * viewer's story mode walks. Short image holds so a visitor sees it advance
 * without waiting; the video runs for as long as it runs.
 */
export const storyReel: ViewerMedia[] = [
  { kind: 'image', src: fullUrl(1039), alt: specimens[0].alt, durationMs: 3000 },
  { kind: 'video', src: '/specimen-motion.mp4', poster: '/specimen-motion.jpg' },
  { kind: 'image', src: fullUrl(1015), alt: specimens[2].alt, durationMs: 3000 },
  { kind: 'image', src: fullUrl(1074), alt: specimens[5].alt, durationMs: 3000 },
];

// A JSON dataset for the FuzzyList demo — a slice of the homelab, searched by
// name / kind / description. Any array of plain objects works the same way.
export interface Node {
  name: string;
  kind: 'service' | 'project' | 'box';
  host: string;
  desc: string;
}

export const nodes: Node[] = [
  { name: 'traefik', kind: 'service', host: 'traefik.lab', desc: 'v3 reverse proxy, TLS, forward-auth entrypoint for every service' },
  { name: 'authelia', kind: 'service', host: 'auth.lab', desc: 'forward-auth identity provider, the login wall in front of the lab' },
  { name: 'ai-agent', kind: 'service', host: 'ai-agent.lab', desc: 'Claude Code conversation archive + live viewer, blue-green deployed' },
  { name: 'gitea', kind: 'service', host: 'gitea.lab', desc: 'self-hosted git forge, scoped-token push behind Authelia' },
  { name: 'grafana', kind: 'service', host: 'grafana.lab', desc: 'dashboards over Loki logs and Prometheus metrics' },
  { name: '3d-gen', kind: 'service', host: '3d-gen.lab', desc: 'image to textured glb via TRELLIS.2 on the EVOX2 box' },
  { name: 'image-gen', kind: 'service', host: 'image-gen.lab', desc: 'prompt to image, Nano Banana or local Ideogram 4' },
  { name: 'music-dl', kind: 'service', host: 'music-dl.lab', desc: 'paste a Spotify link, spotDL downloads and beets autotags' },
  { name: 'sherlock-project', kind: 'project', host: 'sherlock-project.dev', desc: 'styles gallery, source of the image viewer this library ships' },
  { name: 'note-vite', kind: 'project', host: 'note.dev', desc: 'offline-first notes on PocketBase + RxDB, the phone-preview demo' },
  { name: 'insta-pics', kind: 'project', host: 'pics', desc: 'self-hosted photo profile, direct-PocketBase public read' },
  { name: 'zine-maker', kind: 'project', host: 'tools.zine.dev', desc: 'browser mini-zine maker, PDF importer + Konva editor' },
  { name: 'EVOX2', kind: 'box', host: '100.93.171.39', desc: 'Ryzen AI MAX+ 395 Strix Halo, Radeon 8060S iGPU, 96GB unified VRAM' },
  { name: 'raspy2', kind: 'box', host: '100.74.118.12', desc: 'public-facing edge, zipgo/Caddy serves gabvdl.xyz over Tailscale' },
];
