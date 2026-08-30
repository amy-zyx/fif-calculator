import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ParsedFile } from '../adapters/types';
import { ColumnMappingWizard } from './ColumnMappingWizard';

function makeFile(): ParsedFile {
  return {
    fileName: 'my-broker-export.csv',
    headers: ['Date', 'Action', 'Symbol', 'Ccy', 'Total'],
    rows: [
      ['2025-06-10', 'Buy', 'AAPL', 'USD', '22000'],
      ['2025-09-15', 'Sell', 'AAPL', 'USD', '9400'],
    ],
    sourceAccountId: 'acct_1',
  };
}

/** jsdom doesn't implement a real DataTransfer store; the component doesn't need
 * getData (it tracks the dragged column in a ref), so a stub with just the methods
 * React's handlers call is enough. */
function fakeDataTransfer() {
  return { setData: vi.fn(), getData: vi.fn(), effectAllowed: '' };
}

describe('ColumnMappingWizard', () => {
  it('renders every source column and every canonical field dropzone', () => {
    render(<ColumnMappingWizard file={makeFile()} sourceAccountId="acct_1" onComplete={vi.fn()} />);
    expect(screen.getByTestId('source-column-Date')).toBeInTheDocument();
    expect(screen.getByTestId('source-column-Symbol')).toBeInTheDocument();
    expect(screen.getByTestId('dropzone-tradeDate')).toBeInTheDocument();
    expect(screen.getByTestId('dropzone-grossAmount')).toBeInTheDocument();
  });

  it('disables Continue until every required field is mapped', () => {
    render(<ColumnMappingWizard file={makeFile()} sourceAccountId="acct_1" onComplete={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('mapping a column via drag-and-drop moves it out of the unmapped list and updates the preview', () => {
    render(<ColumnMappingWizard file={makeFile()} sourceAccountId="acct_1" onComplete={vi.fn()} />);

    const source = screen.getByTestId('source-column-Date');
    const dropzone = screen.getByTestId('dropzone-tradeDate');

    fireEvent.dragStart(source, { dataTransfer: fakeDataTransfer() });
    fireEvent.drop(dropzone, { dataTransfer: fakeDataTransfer() });

    expect(screen.getByTestId('mapped-value-tradeDate')).toHaveTextContent('Date');
    expect(screen.queryByTestId('source-column-Date')).not.toBeInTheDocument();
  });

  function mapAllRequiredFields() {
    const mappings: Array<[string, string]> = [
      ['Date', 'dropzone-tradeDate'],
      ['Action', 'dropzone-type'],
      ['Symbol', 'dropzone-ticker'],
      ['Ccy', 'dropzone-currency'],
      ['Total', 'dropzone-grossAmount'],
    ];
    for (const [sourceTestId, dropzoneTestId] of mappings) {
      fireEvent.dragStart(screen.getByTestId(`source-column-${sourceTestId}`), {
        dataTransfer: fakeDataTransfer(),
      });
      fireEvent.drop(screen.getByTestId(dropzoneTestId), { dataTransfer: fakeDataTransfer() });
    }
  }

  it('enables Continue once all required fields are mapped, and calls onComplete with parsed txns', () => {
    const onComplete = vi.fn();
    render(<ColumnMappingWizard file={makeFile()} sourceAccountId="acct_1" onComplete={onComplete} />);

    mapAllRequiredFields();

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeEnabled();

    fireEvent.click(continueButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
    const call = onComplete.mock.calls[0];
    if (!call) throw new Error('onComplete was not called');
    const [result] = call;
    expect(result.txns).toHaveLength(2);
    expect(result.profile.columnMapping.tradeDate).toBe('Date');
  });

  it('shows a type-value mapping row for each distinct raw value once the type column is mapped', () => {
    render(<ColumnMappingWizard file={makeFile()} sourceAccountId="acct_1" onComplete={vi.fn()} />);
    fireEvent.dragStart(screen.getByTestId('source-column-Action'), { dataTransfer: fakeDataTransfer() });
    fireEvent.drop(screen.getByTestId('dropzone-type'), { dataTransfer: fakeDataTransfer() });

    expect(screen.getByLabelText('Transaction type for "Buy"')).toBeInTheDocument();
    expect(screen.getByLabelText('Transaction type for "Sell"')).toBeInTheDocument();
  });
});
