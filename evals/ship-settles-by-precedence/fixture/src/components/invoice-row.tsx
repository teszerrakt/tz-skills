type Invoice = { id: string; number: string; due_date: string }

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <li className="invoice-row">
      <span className="invoice-row__number">{invoice.number}</span>
      <span className="invoice-row__due">{invoice.due_date && dateFormat.format(new Date(invoice.due_date))}</span>
    </li>
  )
}
