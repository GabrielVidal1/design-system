import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatRow, StatTile } from './stat-tile';

describe('StatTile', () => {
  it('renders label, value and hint', () => {
    render(<StatTile label="Jobs today" value={128} hint="3 running" roll={false} />);
    expect(screen.getByText('Jobs today')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('3 running')).toBeInTheDocument();
  });

  it('colours a positive delta good when up is good', () => {
    render(<StatTile label="Throughput" value="14/min" delta={12.5} roll={false} />);
    expect(screen.getByText('+12.5%').className).toMatch(/emerald/);
  });

  it('colours a positive delta bad when down is good', () => {
    render(<StatTile label="Errors" value={7} delta={40} goodDirection="down" roll={false} />);
    expect(screen.getByText('+40%').className).toMatch(/rose/);
  });

  it('renders a string delta neutrally', () => {
    render(<StatTile label="Queue" value={3} delta="steady" roll={false} />);
    expect(screen.getByText('steady').className).toMatch(/muted-foreground/);
  });

  it('skeletons the value while loading', () => {
    render(<StatTile label="GPU time" value={42} loading roll={false} />);
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  it('StatRow lays tiles out in a grid', () => {
    const { container } = render(
      <StatRow columns={3}>
        <StatTile label="a" value={1} roll={false} />
        <StatTile label="b" value={2} roll={false} />
      </StatRow>,
    );
    expect((container.firstChild as HTMLElement).className).toMatch(/grid-cols-2/);
    expect((container.firstChild as HTMLElement).className).toMatch(/sm:grid-cols-3/);
  });
});
