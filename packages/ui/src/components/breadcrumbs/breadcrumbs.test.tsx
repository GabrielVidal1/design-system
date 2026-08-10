import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Breadcrumbs } from './breadcrumbs';

describe('Breadcrumbs', () => {
  it('renders every crumb as a link, the last one as the current page', () => {
    render(
      <Breadcrumbs
        items={[{ label: 'Home', href: '/' }, { label: 'Projects', href: '/projects' }, { label: 'design-system' }]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
    const current = screen.getByText('design-system').closest('[aria-current]');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'design-system' })).not.toBeInTheDocument();
  });

  it('fires onClick for a crumb', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Breadcrumbs
        items={[{ label: 'Home', onClick }, { label: 'Page' }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('collapses the middle behind a "…" once there are more crumbs than maxItems', async () => {
    const user = userEvent.setup();
    render(
      <Breadcrumbs
        maxItems={4}
        items={[
          { label: 'Home', href: '/' },
          { label: 'A', href: '/a' },
          { label: 'B', href: '/a/b' },
          { label: 'C', href: '/a/b/c' },
          { label: 'D', href: '/a/b/c/d' },
          { label: 'E' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'A' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'B' })).not.toBeInTheDocument();
    const expand = screen.getByRole('button', { name: 'Show hidden breadcrumbs' });
    await user.click(expand);
    expect(screen.getByRole('link', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'B' })).toBeInTheDocument();
  });

  it('does not collapse when items.length is within maxItems', () => {
    render(
      <Breadcrumbs
        maxItems={4}
        items={[{ label: 'Home', href: '/' }, { label: 'A', href: '/a' }, { label: 'B' }]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Show hidden breadcrumbs' })).not.toBeInTheDocument();
  });
});
