import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DataTable, type DataTableColumn } from './data-table';

interface Job {
  id: string;
  name: string;
  status: string;
  duration: number;
}

const JOBS: Job[] = [
  { id: 'a', name: 'render-scene', status: 'done', duration: 42 },
  { id: 'b', name: 'bake-textures', status: 'running', duration: 7 },
  { id: 'c', name: 'export-glb', status: 'queued', duration: 108 },
];

const COLUMNS: DataTableColumn<Job>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'status', header: 'Status' },
  { key: 'duration', header: 'Duration', sortable: true, align: 'right' },
];

const cellsOf = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => c.textContent);
const bodyRows = () => screen.getAllByRole('row').slice(1); // drop the header row

describe('DataTable', () => {
  it('renders headers and rows', () => {
    render(<DataTable data={JOBS} columns={COLUMNS} getRowKey={(j) => j.id} />);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(3);
    expect(cellsOf(bodyRows()[0])).toEqual(['render-scene', 'done', '42']);
  });

  it('cycles sort asc → desc → off on header click', async () => {
    render(<DataTable data={JOBS} columns={COLUMNS} getRowKey={(j) => j.id} />);
    const btn = screen.getByRole('button', { name: 'Duration' });

    await userEvent.click(btn);
    expect(bodyRows().map((r) => cellsOf(r)[2])).toEqual(['7', '42', '108']);

    await userEvent.click(btn);
    expect(bodyRows().map((r) => cellsOf(r)[2])).toEqual(['108', '42', '7']);

    await userEvent.click(btn);
    expect(bodyRows().map((r) => cellsOf(r)[2])).toEqual(['42', '7', '108']); // source order
  });

  it('honours defaultSort', () => {
    render(
      <DataTable
        data={JOBS}
        columns={COLUMNS}
        getRowKey={(j) => j.id}
        defaultSort={{ key: 'name', dir: 'asc' }}
      />,
    );
    expect(bodyRows().map((r) => cellsOf(r)[0])).toEqual(['bake-textures', 'export-glb', 'render-scene']);
  });

  it('selects rows and select-all', async () => {
    const onSelectedChange = vi.fn();
    render(
      <DataTable
        data={JOBS}
        columns={COLUMNS}
        getRowKey={(j) => j.id}
        selectable
        onSelectedChange={onSelectedChange}
      />,
    );

    await userEvent.click(within(bodyRows()[1]).getByRole('checkbox'));
    expect(onSelectedChange).toHaveBeenLastCalledWith(new Set(['b']));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(onSelectedChange).toHaveBeenLastCalledWith(new Set(['a', 'b', 'c']));
  });

  it('activates rows by click and keyboard', async () => {
    const onRowClick = vi.fn();
    render(<DataTable data={JOBS} columns={COLUMNS} getRowKey={(j) => j.id} onRowClick={onRowClick} />);

    await userEvent.click(within(bodyRows()[0]).getByText('render-scene'));
    expect(onRowClick).toHaveBeenCalledWith(JOBS[0], 0);

    bodyRows()[1].focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(JOBS[1], 1);
  });

  it('shows the empty state', () => {
    render(<DataTable data={[]} columns={COLUMNS} empty={<p>queue is empty</p>} />);
    expect(screen.getByText('queue is empty')).toBeInTheDocument();
  });

  it('collapses to cards below the breakpoint', () => {
    const mql = (matches: boolean) =>
      ({
        matches,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList;
    // useIsMobile(640) asks for (max-width: 639px) — pretend we're a phone
    vi.stubGlobal('matchMedia', (q: string) => mql(q.includes('max-width')));

    render(<DataTable data={JOBS} columns={COLUMNS} getRowKey={(j) => j.id} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getAllByText('Status')).toHaveLength(3); // one label per card

    vi.unstubAllGlobals();
  });
});
