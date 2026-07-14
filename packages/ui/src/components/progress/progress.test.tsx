import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Progress } from './progress';

const bar = () => screen.getByRole('progressbar');

describe('Progress', () => {
  it('exposes value/max through ARIA and fills proportionally', () => {
    render(<Progress value={30} max={120} />);
    expect(bar()).toHaveAttribute('aria-valuenow', '30');
    expect(bar()).toHaveAttribute('aria-valuemax', '120');
    expect(bar()).toHaveAttribute('aria-valuetext', '25%');
    expect((bar().firstChild as HTMLElement).style.width).toBe('25%');
  });

  it('clamps out-of-range values', () => {
    render(<Progress value={150} />);
    expect(bar()).toHaveAttribute('aria-valuenow', '100');
    expect((bar().firstChild as HTMLElement).style.width).toBe('100%');
  });

  it('sweeps when no value is given', () => {
    render(<Progress />);
    expect(bar()).not.toHaveAttribute('aria-valuenow');
    expect(bar().firstChild).toHaveClass('ds-progress-sweep');
  });

  it('shows label and formatted value', () => {
    render(
      <Progress
        value={512}
        max={1024}
        label="Uploading"
        showValue
        format={(v, m) => `${v} / ${m} MB`}
      />,
    );
    expect(screen.getByText('Uploading')).toBeInTheDocument();
    expect(screen.getByText('512 / 1024 MB')).toBeInTheDocument();
    expect(bar()).toHaveAttribute('aria-valuetext', '512 / 1024 MB');
  });

  it('hides the value while indeterminate', () => {
    render(<Progress indeterminate showValue label="Working" />);
    expect(screen.getByText('Working')).toBeInTheDocument();
    expect(screen.queryByText('%', { exact: false })).not.toBeInTheDocument();
  });
});
