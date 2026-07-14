/**
 * Grammars prism-react-renderer doesn't vendor but the lab needs — grafted
 * from prismjs proper. Import order matters: prism-global first (sets the
 * global the components attach to). This module is listed in the package's
 * `sideEffects`, so consumers' bundlers keep these imports.
 */
import './prism-global';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-makefile';

export {};
