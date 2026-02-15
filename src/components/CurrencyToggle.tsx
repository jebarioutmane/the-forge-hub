import { Button } from "@/components/ui/button";

const currencies = ["MAD", "USD", "EUR"] as const;
export type Currency = (typeof currencies)[number];

const rates: Record<Currency, number> = {
  MAD: 1,
  USD: 0.1,
  EUR: 0.092,
};

export function convertCurrency(amountMAD: number, to: Currency): number {
  return amountMAD * rates[to];
}

export function formatCurrency(amount: number, currency: Currency): string {
  const symbols: Record<Currency, string> = { MAD: "MAD", USD: "$", EUR: "€" };
  const prefix = currency === "MAD" ? "" : symbols[currency];
  const suffix = currency === "MAD" ? " MAD" : "";
  return `${prefix}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
}

interface CurrencyToggleProps {
  value: Currency;
  onChange: (c: Currency) => void;
}

export function CurrencyToggle({ value, onChange }: CurrencyToggleProps) {
  return (
    <div className="flex gap-1 bg-muted rounded-lg p-1">
      {currencies.map((c) => (
        <Button
          key={c}
          size="sm"
          variant={value === c ? "default" : "ghost"}
          className="h-7 px-3 text-xs font-medium"
          onClick={() => onChange(c)}
        >
          {c}
        </Button>
      ))}
    </div>
  );
}
