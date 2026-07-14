import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

function Basic(props: React.ComponentProps<typeof Tabs>) {
  return (
    <Tabs {...props}>
      <TabsList aria-label="Job">
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="config">Config</TabsTrigger>
        <TabsTrigger value="raw" disabled>
          Raw
        </TabsTrigger>
      </TabsList>
      <TabsContent value="logs">log output</TabsContent>
      <TabsContent value="config">config body</TabsContent>
      <TabsContent value="raw">raw body</TabsContent>
    </Tabs>
  );
}

const tab = (name: string) => screen.getByRole('tab', { name });

describe('Tabs', () => {
  it('shows only the active panel', () => {
    render(<Basic defaultValue="logs" />);
    expect(screen.getByText('log output')).toBeInTheDocument();
    expect(screen.queryByText('config body')).not.toBeInTheDocument();
  });

  it('falls back to the first enabled tab when no defaultValue is given', () => {
    render(<Basic />);
    expect(tab('Logs')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('log output')).toBeInTheDocument();
  });

  it('switches panels on click and reports the new value', async () => {
    const onValueChange = vi.fn();
    render(<Basic defaultValue="logs" onValueChange={onValueChange} />);

    await userEvent.click(tab('Config'));

    expect(onValueChange).toHaveBeenCalledWith('config');
    expect(screen.getByText('config body')).toBeInTheDocument();
    expect(screen.queryByText('log output')).not.toBeInTheDocument();
  });

  it('stays put when controlled and the parent ignores the change', async () => {
    const onValueChange = vi.fn();
    render(<Basic value="logs" onValueChange={onValueChange} />);

    await userEvent.click(tab('Config'));

    expect(onValueChange).toHaveBeenCalledWith('config');
    expect(tab('Logs')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('log output')).toBeInTheDocument();
  });

  it('wires each tab to its panel for screen readers', () => {
    render(<Basic defaultValue="logs" />);
    const panel = screen.getByRole('tabpanel');
    expect(tab('Logs')).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', tab('Logs').id);
  });

  it('is a single tab stop — only the active trigger is focusable', () => {
    render(<Basic defaultValue="config" />);
    expect(tab('Config')).toHaveAttribute('tabindex', '0');
    expect(tab('Logs')).toHaveAttribute('tabindex', '-1');
  });

  it('arrow keys move and (by default) select, wrapping past the ends', async () => {
    render(<Basic defaultValue="logs" />);
    tab('Logs').focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(tab('Config')).toHaveFocus();
    expect(tab('Config')).toHaveAttribute('aria-selected', 'true');

    // "Raw" is disabled, so ArrowRight wraps around to the first tab.
    await userEvent.keyboard('{ArrowRight}');
    expect(tab('Logs')).toHaveFocus();
    expect(tab('Logs')).toHaveAttribute('aria-selected', 'true');
  });

  it('activation="manual" moves focus without selecting until Enter', async () => {
    render(<Basic defaultValue="logs" activation="manual" />);
    tab('Logs').focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(tab('Config')).toHaveFocus();
    expect(tab('Config')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('log output')).toBeInTheDocument();

    await userEvent.keyboard('{Enter}');
    expect(tab('Config')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('config body')).toBeInTheDocument();
  });

  it('never selects a disabled tab', async () => {
    render(<Basic defaultValue="logs" />);
    await userEvent.click(tab('Raw'));
    expect(tab('Logs')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('raw body')).not.toBeInTheDocument();
  });

  it('keepMounted hides the inactive panel instead of unmounting it', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">panel a</TabsContent>
        <TabsContent value="b" keepMounted>
          panel b
        </TabsContent>
      </Tabs>,
    );

    const hidden = screen.getByText('panel b');
    expect(hidden).toBeInTheDocument();
    expect(hidden).not.toBeVisible();
  });

  it('throws a useful error outside a <Tabs> root', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TabsTrigger value="x">Orphan</TabsTrigger>)).toThrow(/inside <Tabs>/);
    quiet.mockRestore();
  });
});
