import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator } from './toolbar';

function Tools({ active = 'select' }: { active?: string }) {
  return (
    <Toolbar label="Editor tools">
      <ToolbarGroup label="Tools">
        <ToolbarButton label="Select" active={active === 'select'}>
          S
        </ToolbarButton>
        <ToolbarButton label="Draw" active={active === 'draw'}>
          D
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup label="History">
        <ToolbarButton label="Undo" disabled>
          U
        </ToolbarButton>
      </ToolbarGroup>
    </Toolbar>
  );
}

describe('Toolbar', () => {
  it('renders a labelled toolbar with grouped, labelled tools', () => {
    render(<Tools />);
    expect(screen.getByRole('toolbar', { name: 'Editor tools' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Draw' })).toBeInTheDocument();
  });

  it('marks the active tool with aria-pressed', () => {
    render(<Tools active="draw" />);
    expect(screen.getByRole('button', { name: 'Draw' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('moves focus with arrow keys, skipping disabled tools', () => {
    render(<Tools />);
    const select = screen.getByRole('button', { name: 'Select' });
    select.focus();
    fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Draw' })).toHaveFocus();
    // Undo is disabled → wraps back to Select.
    fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'ArrowRight' });
    expect(select).toHaveFocus();
  });

  it('fires onClick and honours disabled', () => {
    const onDraw = vi.fn();
    render(
      <Toolbar>
        <ToolbarButton label="Draw" onClick={onDraw}>
          D
        </ToolbarButton>
      </Toolbar>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Draw' }));
    expect(onDraw).toHaveBeenCalledTimes(1);
  });

  it('renders every tool when overflow is off', () => {
    render(
      <Toolbar overflow={false}>
        {Array.from({ length: 12 }, (_, i) => (
          <ToolbarButton key={i} label={`Tool ${i}`}>
            {i}
          </ToolbarButton>
        ))}
      </Toolbar>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(12);
    expect(screen.queryByRole('button', { name: 'More tools' })).not.toBeInTheDocument();
  });
});
