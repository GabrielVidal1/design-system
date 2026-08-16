import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sparkline } from './sparkline';

describe('Sparkline', () => {
  it('renders nothing for fewer than 2 points', () => {
    const { container } = render(<Sparkline data={[5]} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('draws a line path through every point, sized to width/height', () => {
    const { container } = render(<Sparkline data={[1, 5, 2, 8]} width={80} height={30} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '80');
    expect(svg).toHaveAttribute('height', '30');
    const path = container.querySelector('path');
    expect(path?.getAttribute('d')?.split(' ')).toHaveLength(4);
  });

  it('adds an area path when fill is set', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} fill />);
    expect(container.querySelectorAll('path')).toHaveLength(2);
  });

  it('marks the last point with a dot by default', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />);
    expect(container.querySelector('circle')).toBeInTheDocument();
  });

  it('omits the dot when showLastPoint is false', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} showLastPoint={false} />);
    expect(container.querySelector('circle')).not.toBeInTheDocument();
  });

  it('renders bars in the bar variant', () => {
    const { container } = render(<Sparkline data={[1, 2, 3, 4]} variant="bar" />);
    expect(container.querySelectorAll('rect')).toHaveLength(4);
    expect(container.querySelector('path')).not.toBeInTheDocument();
  });

  it('handles a flat series without dividing by zero', () => {
    const { container } = render(<Sparkline data={[4, 4, 4]} />);
    const path = container.querySelector('path');
    expect(path?.getAttribute('d')).not.toMatch(/NaN/);
  });

  it('is decorative by default (aria-hidden), unless labelled', () => {
    const { container: plain } = render(<Sparkline data={[1, 2, 3]} />);
    expect(plain.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    const { container: labelled } = render(<Sparkline data={[1, 2, 3]} aria-label="CPU trend" />);
    expect(labelled.querySelector('svg')).not.toHaveAttribute('aria-hidden');
  });
});
