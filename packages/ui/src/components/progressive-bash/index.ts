export { ProgressiveBash } from './progressive-bash';
export type { ProgressiveBashProps, ProgressiveBashHandle } from './progressive-bash';
export type { BashEntry, PlaybackTuning } from './playback';
export { computeGapMs, DEFAULT_TUNING } from './playback';
export { tokenizeCommand, splitOutput, classifyLine, parseEchoMarkers, parseMarkerText } from './parse';
export type { CmdToken, CmdKind, OutputLine, OutputSpan, LineKind, SubMarker } from './parse';
