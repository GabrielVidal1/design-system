import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FileEditor } from './file-editor';
import { detectLanguage } from './language';

const textarea = () => screen.getByRole('textbox') as HTMLTextAreaElement;

describe('detectLanguage', () => {
  it('maps extensions and well-known names', () => {
    expect(detectLanguage('scripts/deploy.sh')).toBe('bash');
    expect(detectLanguage('src/app.ts')).toBe('typescript');
    expect(detectLanguage('README.md')).toBe('markdown');
    expect(detectLanguage('index.html')).toBe('markup');
    expect(detectLanguage('Makefile')).toBe('makefile');
    expect(detectLanguage('Dockerfile')).toBe('bash');
    expect(detectLanguage('LICENSE')).toBe('plain');
    expect(detectLanguage(undefined)).toBe('plain');
  });
});

describe('FileEditor', () => {
  it('forwards the ref to the textarea', () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    render(<FileEditor ref={ref} path="run.sh" defaultValue="echo hi" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect(ref.current!.value).toBe('echo hi');
  });

  it('edits uncontrolled content and reports onChange', async () => {
    const onChange = vi.fn();
    render(<FileEditor path="run.sh" defaultValue="" onChange={onChange} />);
    await userEvent.type(textarea(), 'ls');
    expect(textarea().value).toBe('ls');
    expect(onChange).toHaveBeenLastCalledWith('ls');
  });

  it('submits via the Save button and marks the buffer clean', async () => {
    const onSubmit = vi.fn();
    render(<FileEditor path="run.sh" defaultValue="a" onSubmit={onSubmit} />);
    const save = screen.getByRole('button', { name: /save/i });
    expect(save).toBeDisabled(); // clean
    await userEvent.type(textarea(), 'b');
    expect(screen.getByText('● unsaved')).toBeInTheDocument();
    await userEvent.click(save);
    expect(onSubmit).toHaveBeenCalledWith('ab');
    expect(screen.queryByText('● unsaved')).not.toBeInTheDocument();
  });

  it('submits a dirty buffer when focus leaves the editor', async () => {
    const onSubmit = vi.fn();
    render(
      <>
        <FileEditor path="run.sh" defaultValue="a" onSubmit={onSubmit} />
        <button>outside</button>
      </>,
    );
    await userEvent.type(textarea(), '!');
    await userEvent.click(screen.getByText('outside'));
    expect(onSubmit).toHaveBeenCalledWith('a!');
  });

  it('does not submit on blur when submitOnBlur is off', async () => {
    const onSubmit = vi.fn();
    render(
      <>
        <FileEditor path="run.sh" defaultValue="a" onSubmit={onSubmit} submitOnBlur={false} />
        <button>outside</button>
      </>,
    );
    await userEvent.type(textarea(), '!');
    await userEvent.click(screen.getByText('outside'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits on Ctrl+S', async () => {
    const onSubmit = vi.fn();
    render(<FileEditor path="run.sh" defaultValue="" onSubmit={onSubmit} />);
    await userEvent.type(textarea(), 'x');
    await userEvent.keyboard('{Control>}s{/Control}');
    expect(onSubmit).toHaveBeenCalledWith('x');
  });

  it('opens markdown on the preview tab and toggles to edit', async () => {
    render(<FileEditor path="notes.md" defaultValue="# Hello" />);
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Edit' }));
    expect(textarea().value).toBe('# Hello');
  });

  it('shows no preview tab for a plain code file', () => {
    render(<FileEditor path="run.sh" defaultValue="echo" />);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('runs File menu actions and disables Save while clean', async () => {
    const onSubmit = vi.fn();
    render(<FileEditor path="run.sh" defaultValue="a" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('menuitem', { name: 'File' }));
    expect(screen.getByRole('menuitem', { name: /Save/ })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /Download/ })).toBeEnabled();
  });

  it('toggles line numbers from the Tools menu', async () => {
    render(<FileEditor path="run.sh" defaultValue={'a\nb'} />);
    expect(screen.getByText('2')).toBeInTheDocument(); // gutter
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tools' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Line numbers' }));
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('renders extra menus and fires their actions', async () => {
    const onTool = vi.fn();
    render(
      <FileEditor
        path="run.sh"
        defaultValue=""
        menus={[{ label: 'Actions', items: [{ label: 'Do thing', onSelect: onTool }] }]}
      />,
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Do thing' }));
    expect(onTool).toHaveBeenCalled();
  });

  it('tokenizes bash via the grafted prismjs grammar', () => {
    const { container } = render(<FileEditor path="run.sh" defaultValue={'# comment\necho "hi"'} />);
    expect(container.querySelector('.token.comment')).toBeTruthy();
    expect(container.querySelector('.token.string')).toBeTruthy();
  });

  it('respects readOnly', async () => {
    const onSubmit = vi.fn();
    render(<FileEditor path="run.sh" value="locked" readOnly onSubmit={onSubmit} />);
    expect(textarea()).toHaveAttribute('readonly');
    expect(screen.getByText('read-only')).toBeInTheDocument();
  });

  it('honours an external dirty flag', () => {
    render(<FileEditor path="run.sh" value="a" dirty onSubmit={() => {}} />);
    expect(screen.getByText('● unsaved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });
});
