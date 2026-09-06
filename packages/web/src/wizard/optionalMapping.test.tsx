import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ParsedFile } from '../adapters/types';
import { ColumnMappingWizard } from './ColumnMappingWizard';

function file(): ParsedFile {
  return {
    fileName: 'moomoo-export.csv',
    headers: ['Date', 'Action', 'Symbol', 'Ccy', 'Total'],
    rows: [['2025-06-10', 'Buy', 'AAPL', 'USD', '22000']],
    sourceAccountId: 'acct_1',
  };
}

/**
 * Manual column mapping is available on demand, not only when detection fails. An
 * adapter can be confidently wrong — Tiger's doubled fill rows and Sharesies' UTC dates
 * both produce plausible numbers rather than errors — and the user is the one who can
 * tell. Opening the wizard over a file an adapter already read must therefore be
 * possible, and must be reversible.
 */
describe('the wizard as an opt-in override', () => {
  it('offers no Cancel when it is the only way to read the file', () => {
    render(<ColumnMappingWizard file={file()} sourceAccountId="acct_1" onComplete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.getByText(/didn't recognise/i)).toBeInTheDocument();
  });

  it('offers Cancel when opened by choice, so the user is not trapped', () => {
    const onCancel = vi.fn();
    render(
      <ColumnMappingWizard
        file={file()}
        sourceAccountId="acct_1"
        onComplete={vi.fn()}
        onCancel={onCancel}
        detectedLabel="Tiger Trade (Activity Statement)"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('says which adapter it would be replacing, so the choice is informed', () => {
    render(
      <ColumnMappingWizard
        file={file()}
        sourceAccountId="acct_1"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
        detectedLabel="Sharesies (transaction report)"
      />,
    );
    expect(screen.getByText(/Sharesies \(transaction report\)/)).toBeInTheDocument();
    expect(screen.queryByText(/didn't recognise/i)).not.toBeInTheDocument();
  });
});
