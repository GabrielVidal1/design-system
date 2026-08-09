import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InspectorPanel, InspectorRow, InspectorSection } from './inspector-panel';

function Panel(props: Partial<ComponentProps<typeof InspectorPanel>>) {
  return (
    <InspectorPanel title="Rectangle" {...props}>
      <InspectorSection title="Transform">
        <InspectorRow label="X">
          <input aria-label="X" defaultValue={120} />
        </InspectorRow>
      </InspectorSection>
      <InspectorSection title="Fill" defaultCollapsed>
        <InspectorRow label="Colour">
          <input aria-label="Colour" defaultValue="#ff8800" />
        </InspectorRow>
      </InspectorSection>
    </InspectorPanel>
  );
}

describe('InspectorPanel', () => {
  it('renders title, sections and rows inline', () => {
    render(<Panel sheet={false} />);
    expect(screen.getByText('Rectangle')).toBeInTheDocument();
    expect(screen.getByText('Transform')).toBeInTheDocument();
    expect(screen.getByLabelText('X')).toHaveValue('120');
  });

  it('starts collapsed sections folded and toggles them', () => {
    render(<Panel sheet={false} />);
    expect(screen.queryByLabelText('Colour')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fill/ }));
    expect(screen.getByLabelText('Colour')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
    expect(screen.queryByLabelText('X')).not.toBeInTheDocument();
  });

  it('shows a close button when onClose is given', () => {
    const onClose = vi.fn();
    render(<Panel sheet={false} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders as a dismissible bottom-sheet dialog when sheet is forced', () => {
    const onClose = vi.fn();
    render(<Panel sheet onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Inspector' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when the sheet is closed', () => {
    render(<Panel sheet open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
