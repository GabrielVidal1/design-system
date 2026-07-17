import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

import { IconPicker, type IconSet } from './icon-picker';

// @tanstack/react-virtual reads offsetWidth/offsetHeight to decide how many
// columns to mount; both are 0 in jsdom (no layout), so stub a real-ish box.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 200,
  });
});

const Glyph = (label: string) => () => <svg data-glyph={label} />;

const ICONS: IconSet = {
  house: Glyph('house'),
  mail: Glyph('mail'),
  github: Glyph('github'),
  globe: Glyph('globe'),
};

function Controlled({ icons = ICONS }: { icons?: IconSet }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div>
      <span data-testid="value">{value ?? '—'}</span>
      <IconPicker icons={icons} value={value} onChange={setValue} rows={2} />
    </div>
  );
}

describe('IconPicker', () => {
  it('renders a searchable option per icon', () => {
    render(<Controlled />);
    for (const name of Object.keys(ICONS)) {
      expect(screen.getByRole('option', { name })).toBeInTheDocument();
    }
  });

  it('filters by icon name from the search box', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.type(screen.getByRole('searchbox'), 'git');
    expect(screen.getByRole('option', { name: 'github' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'mail' })).not.toBeInTheDocument();
  });

  it('reports the clicked icon and marks it selected', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByRole('option', { name: 'mail' }));
    expect(screen.getByTestId('value')).toHaveTextContent('mail');
    expect(screen.getByRole('option', { name: 'mail' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows the empty label when nothing matches', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.type(screen.getByRole('searchbox'), 'zzzznope');
    expect(screen.getByText('No icons match.')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('only mounts a subset of a large set (columns are virtualized)', () => {
    const big: IconSet = {};
    for (let i = 0; i < 1000; i++) big[`icon-${i}`] = Glyph(`icon-${i}`);
    render(<IconPicker icons={big} rows={4} />);
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThan(1000);
    expect(screen.getByRole('option', { name: 'icon-0' })).toBeInTheDocument();
  });
});
