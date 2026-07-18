import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PalettePicker } from './palette-picker';
import { ColorThemeProvider, paletteToVars, useColorTheme } from './color-theme';

function Controlled({
  initial,
  min,
  max,
  onChange,
}: {
  initial: string[];
  min?: number;
  max?: number;
  onChange?: (p: string[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <PalettePicker
      value={value}
      min={min}
      max={max}
      onChange={(p) => {
        setValue(p);
        onChange?.(p);
      }}
    />
  );
}

describe('PalettePicker', () => {
  it('renders a trigger showing the swatch count', () => {
    render(<PalettePicker value={['#ff0000', '#00ff00', '#0000ff']} onChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: 'Colour palette' });
    expect(trigger).toHaveTextContent('3');
  });

  it('opens the editor and lists one row per colour', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={['#ff0000', '#00ff00', '#0000ff']} />);
    await user.click(screen.getByRole('button', { name: 'Colour palette' }));
    expect(screen.getByRole('dialog', { name: 'Palette editor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hex for colour 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Hex for colour 3')).toBeInTheDocument();
  });

  it('Add appends a colour up to max, Random keeps the count', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={['#ff0000', '#00ff00', '#0000ff']} max={4} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Colour palette' }));

    await user.click(screen.getByRole('button', { name: 'Add colour' }));
    expect(onChange.mock.lastCall?.[0]).toHaveLength(4);

    // At max now — Add is disabled.
    expect(screen.getByRole('button', { name: 'Add colour' })).toBeDisabled();

    onChange.mockClear();
    await user.click(screen.getByRole('button', { name: 'Random palette' }));
    expect(onChange.mock.lastCall?.[0]).toHaveLength(4);
  });

  it('does not remove below the minimum', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={['#ff0000', '#00ff00', '#0000ff']} min={3} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Colour palette' }));
    const removeButtons = screen.getAllByRole('button', { name: 'Remove colour' });
    removeButtons.forEach((b) => expect(b).toBeDisabled());
  });

  it('commits a valid hex typed into a row', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={['#ff0000', '#00ff00', '#0000ff']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Colour palette' }));

    const field = screen.getByLabelText('Hex for colour 1');
    await user.clear(field);
    await user.type(field, '112233');
    await user.tab();
    expect(onChange.mock.lastCall?.[0][0]).toBe('#112233');
  });
});

describe('ColorThemeProvider / paletteToVars', () => {
  it('maps the accent onto the shared tokens', () => {
    const vars = paletteToVars({ palette: ['#3366ff', '#ff3366'] }) as Record<string, string>;
    expect(vars['--palette-0']).toBe('#3366ff');
    expect(vars['--palette-1']).toBe('#ff3366');
    expect(vars['--primary']).toBe('#3366ff');
    expect(vars['--ring']).toBe('#3366ff');
    expect(vars['--primary-foreground']).toBe('#ffffff'); // dark accent → light text
  });

  it('applies the vars to its scoped wrapper', () => {
    render(
      <ColorThemeProvider palette={['#123456']}>
        <span>child</span>
      </ColorThemeProvider>,
    );
    const scope = screen.getByText('child').parentElement as HTMLElement;
    expect(scope.style.getPropertyValue('--primary')).toBe('#123456');
  });

  it('exposes the palette through useColorTheme', () => {
    render(
      <ColorThemeProvider palette={['#abcdef', '#fedcba']}>
        <Probe />
      </ColorThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('2 colours, accent #abcdef');
  });
});

function Probe() {
  const t = useColorTheme();
  return (
    <div data-testid="probe">
      {t ? `${t.palette.length} colours, accent ${t.palette[0]}` : 'no theme'}
    </div>
  );
}
