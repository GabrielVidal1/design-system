import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '../input';
import { Field } from './field';

describe('Field', () => {
  it('wires the label to the control via a generated id', () => {
    render(
      <Field label="Name">
        <Input placeholder="Ada" />
      </Field>,
    );

    const input = screen.getByRole('textbox');
    const label = screen.getByText('Name');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', input.id);
  });

  it('shows a required marker without setting the required attribute', () => {
    render(
      <Field label="Name" required>
        <Input />
      </Field>,
    );

    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).not.toBeRequired();
  });

  it('renders the hint and wires it via aria-describedby', () => {
    render(
      <Field label="Email" hint="We'll never share it">
        <Input />
      </Field>,
    );

    const input = screen.getByRole('textbox');
    const hint = screen.getByText("We'll never share it");
    expect(input).toHaveAttribute('aria-describedby', hint.id);
  });

  it('prefers the error over the hint, and marks the control invalid', () => {
    render(
      <Field label="Email" hint="We'll never share it" error="Required">
        <Input />
      </Field>,
    );

    expect(screen.queryByText("We'll never share it")).not.toBeInTheDocument();
    const input = screen.getByRole('textbox');
    const error = screen.getByText('Required');
    expect(input).toHaveAttribute('aria-describedby', error.id);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('respects an explicit htmlFor instead of generating one', () => {
    render(
      <Field label="Name" htmlFor="my-id">
        <Input id="my-id" />
      </Field>,
    );

    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'my-id');
    expect(screen.getByText('Name')).toHaveAttribute('for', 'my-id');
  });
});
