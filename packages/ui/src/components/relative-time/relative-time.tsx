import * as React from 'react';

import { fmtDateTime, relTime, type TimeInput } from '../../lib/format';

export interface RelativeTimeProps extends React.TimeHTMLAttributes<HTMLTimeElement> {
  date: TimeInput;
  /** Re-render cadence, ms. `0` freezes it. */
  every?: number;
}

/**
 * `<time>` that says "4m ago" and keeps saying the right thing — it ticks, so a
 * dashboard left open overnight doesn't still claim the job ran "just now".
 * Hovering shows the absolute timestamp.
 */
export function RelativeTime({ date, every = 30_000, ...props }: RelativeTimeProps) {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    if (!every) return;
    const id = setInterval(tick, every);
    return () => clearInterval(id);
  }, [every]);

  return (
    <time title={fmtDateTime(date)} {...props}>
      {relTime(date)}
    </time>
  );
}
