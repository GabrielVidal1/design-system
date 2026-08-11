import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BottomNav, type BottomNavLink } from './bottom-nav';

const Dot = ({ className }: { className?: string }) => <svg className={className} data-testid="icon" />;

const SUB: BottomNavLink[] = [
  { key: 'memories', label: 'Memories', href: '/memories', icon: Dot },
  { key: 'skills', label: 'Skills', href: '/skills', icon: Dot },
];

const LINKS: BottomNavLink[] = [
  { key: 'dashboards', label: 'Dashboards', href: '/dashboards', icon: Dot },
  { key: 'files', label: 'Files', href: '/files', icon: Dot, children: SUB },
  { key: 'conversation', label: 'Conversation', href: '/', icon: Dot },
  { key: 'projects', label: 'Projects', href: '/projects', icon: Dot },
  { key: 'settings', label: 'Settings', href: '/settings', icon: Dot },
];

const link = (name: string) => screen.getByRole('link', { name });
const drawer = () => screen.queryByRole('group', { name: 'Files sub-links' });
/** The drawer stays mounted for one closing transition. */
const settle = () => act(() => new Promise((r) => setTimeout(r, 300)));

describe('BottomNav', () => {
  it('renders every link with its label and href', () => {
    render(<BottomNav links={LINKS} />);
    for (const l of LINKS) expect(link(l.label)).toHaveAttribute('href', l.href);
  });

  it('marks the selected link as the current page', () => {
    render(<BottomNav links={LINKS} selectedLink="projects" />);
    expect(link('Projects')).toHaveAttribute('aria-current', 'page');
    expect(link('Files')).not.toHaveAttribute('aria-current');
  });

  it('marks a parent as current when one of its sub-links is selected', () => {
    render(<BottomNav links={LINKS} selectedLink="skills" />);
    expect(link('Files')).toHaveAttribute('aria-current', 'page');
  });

  it('calls onNavigate with source "tap" when a link is tapped', async () => {
    const onNavigate = vi.fn();
    render(<BottomNav links={LINKS} onNavigate={onNavigate} />);
    await userEvent.click(link('Projects'));
    expect(onNavigate).toHaveBeenCalledWith(LINKS[3], { source: 'tap' });
  });

  it('lets onSelect preventDefault to own the tap', async () => {
    const onNavigate = vi.fn();
    render(<BottomNav links={LINKS} onNavigate={onNavigate} onSelect={(_l, e) => e.preventDefault()} />);
    await userEvent.click(link('Projects'));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate a disabled link', async () => {
    const onNavigate = vi.fn();
    render(<BottomNav links={[{ key: 'a', label: 'Alpha', href: '/a', disabled: true }]} onNavigate={onNavigate} />);
    await userEvent.click(link('Alpha'));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  describe('centre bubble', () => {
    /** The bubble is the only item whose icon sits in a raised rounded box. */
    const raised = () =>
      Array.from(document.querySelectorAll('a')).find((a) => a.querySelector('.-translate-y-3'))?.textContent;

    it('defaults to the middle slot', () => {
      render(<BottomNav links={LINKS} />);
      expect(raised()).toContain('Conversation');
    });

    it('takes a key', () => {
      render(<BottomNav links={LINKS} center="settings" />);
      expect(raised()).toContain('Settings');
    });

    it('takes an index', () => {
      render(<BottomNav links={LINKS} center={0} />);
      expect(raised()).toContain('Dashboards');
    });

    it('can be turned off', () => {
      render(<BottomNav links={LINKS} center={false} />);
      expect(raised()).toBeUndefined();
    });
  });

  describe('sub-link drawer', () => {
    it('navigates on the first tap and opens on the second', async () => {
      const onNavigate = vi.fn();
      const { rerender } = render(<BottomNav links={LINKS} onNavigate={onNavigate} />);

      await userEvent.click(link('Files'));
      expect(onNavigate).toHaveBeenCalledWith(LINKS[1], { source: 'tap' });
      expect(drawer()).not.toBeInTheDocument();

      // …the app is now in the Files section, so the next tap is the drawer's.
      rerender(<BottomNav links={LINKS} selectedLink="files" onNavigate={onNavigate} />);
      await userEvent.click(link('Files'));
      expect(drawer()).toBeInTheDocument();
      expect(link('Memories')).toHaveAttribute('href', '/memories');
      expect(link('Files')).toHaveAttribute('aria-expanded', 'true');
      expect(onNavigate).toHaveBeenCalledTimes(1);

      await userEvent.click(link('Files'));
      await settle();
      expect(drawer()).not.toBeInTheDocument();
    });

    it('opens on the first tap when the parent is no destination of its own', async () => {
      const links = [LINKS[0], { ...LINKS[1], href: undefined }, LINKS[2]];
      const onNavigate = vi.fn();
      render(<BottomNav links={links} onNavigate={onNavigate} />);
      // A parent with no href of its own renders as a button, not a link.
      await userEvent.click(screen.getByRole('button', { name: 'Files' }));
      expect(drawer()).toBeInTheDocument();
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('navigates and closes when a sub-link is tapped', async () => {
      const onNavigate = vi.fn();
      render(<BottomNav links={LINKS} selectedLink="files" onNavigate={onNavigate} />);
      await userEvent.click(link('Files'));
      await userEvent.click(link('Skills'));

      expect(onNavigate).toHaveBeenCalledWith(SUB[1], { source: 'tap' });
      await settle();
      expect(drawer()).not.toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      render(<BottomNav links={LINKS} selectedLink="files" />);
      await userEvent.click(link('Files'));
      await userEvent.keyboard('{Escape}');
      await settle();
      expect(drawer()).not.toBeInTheDocument();
    });

    it('can be controlled', async () => {
      const onOpenLinkChange = vi.fn();
      render(<BottomNav links={LINKS} openLink="files" onOpenLinkChange={onOpenLinkChange} />);
      expect(drawer()).toBeInTheDocument();
      await userEvent.click(link('Files'));
      expect(onOpenLinkChange).toHaveBeenCalledWith(null);
    });

    it('shows every sub-link when it is not editable', async () => {
      const many = Array.from({ length: 8 }, (_, i) => ({ key: `s${i}`, label: `Sub ${i}`, href: `/s${i}` }));
      render(<BottomNav links={[{ ...LINKS[1], children: many }]} selectedLink="files" />);
      await userEvent.click(link('Files'));
      for (const m of many) expect(link(m.label)).toBeInTheDocument();
    });

    it('keeps only the first maxSlots sub-links in the row when editable', async () => {
      const many = Array.from({ length: 8 }, (_, i) => ({ key: `s${i}`, label: `Sub ${i}`, href: `/s${i}` }));
      render(<BottomNav links={[{ ...LINKS[1], children: many }]} selectedLink="files" editable maxSlots={5} />);
      await userEvent.click(link('Files'));
      // The overflow lives in the hold-to-rearrange stash, not the row.
      expect(screen.getAllByRole('link', { name: /^Sub \d$/ })).toHaveLength(5);
      expect(link('Sub 4')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Sub 5' })).not.toBeInTheDocument();
    });
  });

  describe('renderLink', () => {
    it('renders destinations through the caller', () => {
      render(
        <BottomNav
          links={LINKS}
          selectedLink="files"
          renderLink={({ link: l, props: { href: _href, ...rest } }) => (
            <button type="button" {...rest} data-key={l.key} />
          )}
        />,
      );
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Files' })).toHaveAttribute('data-key', 'files');
      expect(screen.getByRole('button', { name: 'Files' })).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('floating', () => {
    it('detaches the bar from the bottom edge', () => {
      const { rerender } = render(<BottomNav links={LINKS} />);
      expect(screen.getByRole('navigation')).not.toHaveAttribute('data-floating');
      rerender(<BottomNav links={LINKS} floating />);
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('data-floating');
      expect(nav.className).toContain('fixed');
    });
  });

  describe('swipeNavigation', () => {
    /** One horizontal touch swipe over `document`, `dx` px wide. */
    async function swipe(dx: number, dy = 0) {
      const opts = { pointerId: 1, pointerType: 'touch', bubbles: true } as PointerEventInit;
      const target = document.body;
      await act(async () => {
        target.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: 200, clientY: 300 }));
        target.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 200 + dx / 2, clientY: 300 + dy }));
        target.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 200 + dx, clientY: 300 + dy }));
      });
    }

    it('walks to the next link on a swipe left', async () => {
      const onNavigate = vi.fn();
      render(<BottomNav links={LINKS} selectedLink="files" swipeNavigation onNavigate={onNavigate} />);
      await swipe(-150);
      expect(onNavigate).toHaveBeenCalledWith(LINKS[2], { source: 'swipe' });
    });

    it('walks to the previous link on a swipe right', async () => {
      const onNavigate = vi.fn();
      render(<BottomNav links={LINKS} selectedLink="files" swipeNavigation onNavigate={onNavigate} />);
      await swipe(150);
      expect(onNavigate).toHaveBeenCalledWith(LINKS[0], { source: 'swipe' });
    });

    it('stops at the ends unless swipeWrap is set', async () => {
      const onNavigate = vi.fn();
      const { rerender } = render(
        <BottomNav links={LINKS} selectedLink="settings" swipeNavigation onNavigate={onNavigate} />,
      );
      await swipe(-150);
      expect(onNavigate).not.toHaveBeenCalled();

      rerender(<BottomNav links={LINKS} selectedLink="settings" swipeNavigation swipeWrap onNavigate={onNavigate} />);
      await swipe(-150);
      expect(onNavigate).toHaveBeenCalledWith(LINKS[0], { source: 'swipe' });
    });

    it('walks the sub-links while a section is expanded', async () => {
      const onNavigate = vi.fn();
      render(<BottomNav links={LINKS} selectedLink="memories" swipeNavigation onNavigate={onNavigate} />);
      // memories → skills, inside the Files section…
      await swipe(-150);
      expect(onNavigate).toHaveBeenLastCalledWith(SUB[1], { source: 'swipe' });
      // …and out of it, past the last sub-link.
      onNavigate.mockClear();
      render(<BottomNav links={LINKS} selectedLink="skills" swipeNavigation onNavigate={onNavigate} />);
      await swipe(-150);
      expect(onNavigate).toHaveBeenLastCalledWith(LINKS[2], { source: 'swipe' });
    });

    it('ignores a mostly-vertical drag and a short one', async () => {
      const onNavigate = vi.fn();
      render(<BottomNav links={LINKS} selectedLink="files" swipeNavigation onNavigate={onNavigate} />);
      await swipe(-150, -400);
      await swipe(-20);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('ignores a swipe that starts inside the bar', async () => {
      const onNavigate = vi.fn();
      render(<BottomNav links={LINKS} selectedLink="files" swipeNavigation onNavigate={onNavigate} />);
      const bar = link('Projects');
      const opts = { pointerId: 2, pointerType: 'touch', bubbles: true } as PointerEventInit;
      await act(async () => {
        bar.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: 200, clientY: 300 }));
        bar.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 120, clientY: 300 }));
        bar.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 50, clientY: 300 }));
      });
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('drags the swipe target with the finger, then lets it go', async () => {
      const onNavigate = vi.fn();
      function Harness() {
        const ref = React.useRef<HTMLDivElement>(null);
        return (
          <>
            <div ref={ref} data-testid="page" style={{ height: 200 }} />
            <BottomNav
              links={LINKS}
              selectedLink="files"
              swipeNavigation
              swipeTarget={ref}
              onNavigate={onNavigate}
            />
          </>
        );
      }
      render(<Harness />);
      const page = screen.getByTestId('page');
      const opts = { pointerId: 3, pointerType: 'touch', bubbles: true } as PointerEventInit;

      await act(async () => {
        page.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: 200, clientY: 300 }));
        page.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 100, clientY: 300 }));
      });
      expect(page.style.transform).toBe('translate3d(-35px,0,0)');

      await act(async () => {
        page.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 40, clientY: 300 }));
      });
      expect(page.style.transform).toBe('');
      expect(onNavigate).toHaveBeenCalledWith(LINKS[2], { source: 'swipe' });
    });

    it('does nothing when the prop is off', async () => {
      const onNavigate = vi.fn();
      render(<BottomNav links={LINKS} selectedLink="files" onNavigate={onNavigate} />);
      await swipe(-150);
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });
});
