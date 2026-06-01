"use client";

import { useState } from "react";

interface Props {
  onCreate: (name: string, startingBalance: number, notes?: string) => void;
  onLoadSample?: () => void;
  showSample?: boolean;
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function defaultMonthName(): string {
  const d = new Date();
  return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

export function MonthSetup({ onCreate, onLoadSample, showSample }: Props) {
  const [name, setName] = useState(defaultMonthName());
  const [balance, setBalance] = useState("200");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startingBalance = parseFloat(balance);
    if (!name.trim()) {
      setError("Please enter a month name.");
      return;
    }
    if (!Number.isFinite(startingBalance) || startingBalance <= 0) {
      setError("Starting balance must be a positive number.");
      return;
    }
    setError(null);
    onCreate(name.trim(), startingBalance, notes.trim() || undefined);
    setNotes("");
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1">Start a new trading month</h2>
      <p className="text-sm text-gray-400 mb-4">
        Set a starting balance and begin logging trades.
      </p>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-1">
          <label className="label" htmlFor="month-name">Month name</label>
          <input
            id="month-name"
            className="input"
            placeholder="June 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="sm:col-span-1">
          <label className="label" htmlFor="month-balance">Starting balance ($)</label>
          <input
            id="month-balance"
            className="input"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="month-notes">Notes (optional)</label>
          <input
            id="month-notes"
            className="input"
            placeholder="$200 monthly challenge"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {error && (
          <div className="sm:col-span-2 text-sm text-loss">{error}</div>
        )}
        <div className="sm:col-span-2 flex flex-wrap gap-2 mt-1">
          <button type="submit" className="btn-primary">Create month</button>
          {showSample && onLoadSample && (
            <button type="button" className="btn-ghost" onClick={onLoadSample}>
              Load sample data
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
