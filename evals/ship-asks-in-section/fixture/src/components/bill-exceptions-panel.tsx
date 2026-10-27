import { currencies } from '../db/seeds/currencies'

type Exception = { id: string; reason: string; amount: number; currency: string }

export function BillExceptionsPanel({ exceptions }: { exceptions: Exception[] }) {
  return (
    <section>
      <h2>Exceptions ({exceptions.length})</h2>
      <ul>
        {exceptions.map((e) => (
          <li key={e.id}>
            {e.reason}: {formatAmount(e.amount, e.currency)}
          </li>
        ))}
      </ul>
    </section>
  )
}

function formatAmount(amount: number, code: string) {
  const decimals = currencies.find((c) => c.code === code)?.decimals ?? 2
  return amount.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
