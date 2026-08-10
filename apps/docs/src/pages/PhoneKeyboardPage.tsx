import { useRef, useState, type ReactNode } from 'react';
import {
  Button,
  PhoneKeyboard,
  PhoneKeyboardProvider,
  PhonePreview,
  PhoneTextField,
  Select,
  Switch,
  usePhoneText,
  type PhoneKeyboardHandle,
  type PhoneKeyboardLayoutName,
  type PhonePreviewHandle,
} from '@gabvdl/ui';
import { CornerDownLeft, Delete, Keyboard, Send, Square, Type } from 'lucide-react';

/* ── shared specimen-sheet bits (mirrors the other component pages) ───────── */
function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-10 first:border-t-0">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="mono text-[11px] text-[color:var(--cyan-deep)]">{String(n).padStart(2, '0')}</span>
        <h2 className="display text-xl text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Code({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-[var(--surface)]">
      {lang && (
        <div className="border-b border-border px-3.5 py-1.5 mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {lang}
        </div>
      )}
      <pre className="overflow-x-auto p-3.5 text-[0.78rem] leading-relaxed">
        <code className="mono text-foreground">{code}</code>
      </pre>
    </div>
  );
}

/* ── the screen above the keyboard ───────────────────────────────────────── */

const REPLIES = [
  { from: 'them', text: 'the phone mockup on the landing page — can the keyboard actually type?' },
];

/** A messages screen whose composer is fed by the keyboard below it. */
function ChatScreen({ onSend }: { onSend?: () => void }) {
  const { value } = usePhoneText();
  const [sent, setSent] = useState<string[]>([]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <span className="grid size-7 place-items-center rounded-full bg-[var(--tint-strong)] text-[11px] text-foreground">
          GV
        </span>
        <span className="text-[13px] font-medium text-foreground">Gabriel</span>
      </div>
      <div className="flex-1 space-y-2 overflow-auto px-3 py-3">
        {REPLIES.map((m) => (
          <div key={m.text} className="max-w-[85%] rounded-2xl rounded-bl-md bg-[var(--tint)] px-3 py-2 text-[13px] text-foreground">
            {m.text}
          </div>
        ))}
        {sent.map((m, i) => (
          <div
            key={i}
            className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[color:var(--cyan-deep)] px-3 py-2 text-[13px] text-white"
          >
            {m}
          </div>
        ))}
      </div>
      <div className="px-2.5 pb-2.5">
        <PhoneTextField placeholder="Message">
          <button
            type="button"
            aria-label="Send"
            onClick={() => {
              if (!value.trim()) return;
              setSent((prev) => [...prev, value]);
              onSend?.();
            }}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-[color:var(--cyan-deep)] text-white disabled:opacity-40"
            disabled={!value.trim()}
          >
            <Send size={14} />
          </button>
        </PhoneTextField>
      </div>
    </div>
  );
}

/* ── section 1: the keyboard driven through the ref ──────────────────────── */

const SCRIPT = 'Yes — it types character by character.';
const REPLACEMENT = 'It holds delete to replace what is there.';

function DrivenPhone() {
  const phone = useRef<PhonePreviewHandle>(null);
  const [busy, setBusy] = useState(false);

  const drive = async (fn: (kb: PhoneKeyboardHandle) => Promise<void>) => {
    const kb = phone.current?.keyboard;
    if (!kb) return;
    setBusy(true);
    await fn(kb);
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-center">
      <PhonePreview
        ref={phone}
        screenWidth={300}
        deviceHeight={780}
        statusBar
        keyboard={{ layout: 'azerty', onEnter: () => false }}
      >
        <ChatScreen onSend={() => phone.current?.keyboard?.setValue('')} />
      </PhonePreview>

      <div className="flex w-full max-w-[300px] flex-col gap-2 sm:pt-6">
        <Button
          icon={<Type size={14} />}
          onClick={() => drive((kb) => kb.type(SCRIPT))}
          disabled={busy}
        >
          Type a sentence
        </Button>
        <Button
          variant="outline"
          icon={<Delete size={14} />}
          onClick={() => drive((kb) => kb.replace(REPLACEMENT))}
          disabled={busy}
        >
          Hold delete, then replace
        </Button>
        <Button
          variant="outline"
          icon={<CornerDownLeft size={14} />}
          onClick={() => drive((kb) => kb.type(' 🙂', { cps: 6 }))}
          disabled={busy}
        >
          Add an emoji
        </Button>
        <Button
          variant="ghost"
          icon={<Square size={14} />}
          onClick={() => phone.current?.keyboard?.stop()}
        >
          Stop
        </Button>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          The keys are real — tap them. Watch the shift key catch the capital, the{' '}
          <code className="mono">?123</code> page flip for the em dash, and the delete key stay lit
          while it eats the old text.
        </p>
      </div>
    </div>
  );
}

/* ── section 2: layouts, themes, chrome ──────────────────────────────────── */

function StandaloneKeyboard() {
  const kb = useRef<PhoneKeyboardHandle>(null);
  const [layout, setLayout] = useState<PhoneKeyboardLayoutName>('azerty');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toolbar, setToolbar] = useState(true);
  const [navBar, setNavBar] = useState(true);
  const [capture, setCapture] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32">
          <Select
            label="Layout"
            options={[
              { value: 'azerty', label: 'AZERTY' },
              { value: 'qwerty', label: 'QWERTY' },
            ]}
            value={layout}
            onValueChange={(v) => setLayout(v as PhoneKeyboardLayoutName)}
          />
        </div>
        <div className="w-32">
          <Select
            label="Theme"
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
            value={theme}
            onValueChange={(v) => setTheme(v as 'dark' | 'light')}
          />
        </div>
        <Switch label="Toolbar" checked={toolbar} onCheckedChange={setToolbar} />
        <Switch label="Nav bar" checked={navBar} onCheckedChange={setNavBar} />
        <Switch
          label="Capture my keyboard"
          description="Click the keys, then type for real"
          checked={capture}
          onCheckedChange={setCapture}
        />
      </div>

      <PhoneKeyboardProvider defaultValue="">
        <div className="mx-auto w-[390px] max-w-full overflow-hidden rounded-xl border border-border bg-[var(--surface)]">
          <div className="p-3">
            <PhoneTextField placeholder="Tap the keys below" />
          </div>
          <PhoneKeyboard
            ref={kb}
            layout={layout}
            theme={theme}
            toolbar={toolbar}
            navBar={navBar}
            captureKeys={capture}
            spaceLabel={layout === 'azerty' ? 'FR • EN' : 'English'}
          />
        </div>
      </PhoneKeyboardProvider>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => kb.current?.type('bonjour, ça marche !')}>
          type()
        </Button>
        <Button size="sm" variant="outline" onClick={() => kb.current?.backspace(3)}>
          backspace(3)
        </Button>
        <Button size="sm" variant="outline" onClick={() => kb.current?.backspace()}>
          hold delete
        </Button>
        <Button size="sm" variant="ghost" onClick={() => kb.current?.setValue('')}>
          clear
        </Button>
      </div>
    </div>
  );
}

/* ── the page ────────────────────────────────────────────────────────────── */

export function PhoneKeyboardPage() {
  return (
    <div className="mx-auto max-w-3xl px-5">
      <div className="py-8">
        <p className="eyebrow mb-2">Inputs</p>
        <h1 className="display flex items-center gap-2 text-3xl text-foreground">
          <Keyboard size={26} className="text-[color:var(--cyan-deep)]" />
          PhoneKeyboard
        </h1>
        <p className="mono mt-2 text-[13px] text-muted-foreground">
          ref.type · ref.replace · ref.backspace · PhoneTextField · PhoneKeyboardProvider
        </p>
      </div>

      <p className="mb-8 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
        Gboard, traced off a real Pixel screenshot: ten columns of 107px, 1.54-wide
        shift and delete keys, a four-column space bar, the hint glyphs above each
        letter, the tool strip and the Android nav bar. It is a working keyboard —
        the keys tap — but the point is the <code className="mono">ref</code>: ask
        it to <code className="mono">type()</code> and the text arrives character by
        character with the real key lighting up under each one, shift tapped for
        capitals and <code className="mono">?123</code> flipped for symbols. Ask it
        to <code className="mono">replace()</code> and it holds the delete key down —
        accelerating, then eating whole words — before typing the new text.
      </p>

      <Section n={1} title="Driven by its ref">
        <div className="mb-5 rounded-xl border border-border bg-[var(--surface-2)] p-5">
          <DrivenPhone />
        </div>
        <Code
          lang="tsx"
          code={`import { PhonePreview, PhoneTextField } from '@gabvdl/ui'
import '@gabvdl/ui/keyboard.css'   // caret blink + per-character motion

const phone = useRef<PhonePreviewHandle>(null)

<PhonePreview statusBar keyboard>
  <ChatScreen />              {/* holds a <PhoneTextField /> */}
</PhonePreview>

// the whole feature, three calls:
await phone.current.keyboard.type('Yes — it types character by character.')
await phone.current.keyboard.replace('It holds delete to replace what is there.')
phone.current.keyboard.stop()   // cancel mid-animation`}
        />
      </Section>

      <Section n={2} title="Layouts, themes, chrome">
        <div className="mb-5 rounded-xl border border-border bg-[var(--surface-2)] p-5">
          <StandaloneKeyboard />
        </div>
        <Code
          lang="tsx"
          code={`// standalone: one provider shares the buffer between field and keys
<PhoneKeyboardProvider onValueChange={setDraft}>
  <PhoneTextField placeholder="Tap the keys below" />
  <PhoneKeyboard
    ref={kb}
    layout="qwerty"        // 'azerty' | 'qwerty' | your own layout object
    theme="light"          // 'dark' | 'light' | { bg, glyph, pill, accent, … }
    width={390}            // every dimension scales off this
    toolbar navBar         // the GIF/clipboard strip and the Android nav row
    spaceLabel="FR • EN"
    labelCase="upper"      // as on the reference; 'auto' lower-cases until shift
    autoCapitalize         // shift engages at the start of a sentence
    captureKeys            // route the physical keyboard through the keys too
  />
</PhoneKeyboardProvider>`}
        />
      </Section>

      <Section n={3} title="The handle">
        <Code
          lang="ts"
          code={`interface PhoneKeyboardHandle {
  readonly value: string          // what is in the buffer
  readonly busy: boolean          // an animation is running

  type(text, {                    // one character at a time
    cps = 11,                     //   characters per second
    jitter = 0.4,                 //   ± wobble on every gap, so it reads as a thumb
    punctuationPause = 240,       //   the breath after . ! ? ,
    flash = 110,                  //   how long each key stays lit
  }): Promise<void>

  backspace(count?, {             // hold the delete key
    holdDelay = 420,              //   before the repeat kicks in
    from = 115, to = 26,          //   repeat interval, accelerating
    ramp = 12,                    //   over this many repeats
    wordsAfter = 18,              //   then it starts eating whole words
  }): Promise<void>

  replace(text, options?): Promise<void>   // backspace() to empty, then type()
  press(key): void                // one key: 'a' | '!' | 'backspace' | 'shift' | …
  setValue(text): void            // jump, no animation
  stop(): void                    // cancel; pending promises resolve
}`}
        />
        <p className="mt-4 max-w-2xl text-[0.9rem] leading-relaxed text-muted-foreground">
          Every animation cancels the one before it, and a real tap on a key wins over
          a running animation — so a visitor can always interrupt the demo. Under{' '}
          <code className="mono">prefers-reduced-motion</code> the caret stops blinking
          and characters land without the pop; the timing of the typing itself is yours
          to set through <code className="mono">cps</code>.
        </p>
      </Section>
    </div>
  );
}
