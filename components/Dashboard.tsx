"use client";

import { useState } from "react";
import { useTradingData } from "@/hooks/useTradingData";
import { MonthSetup } from "./MonthSetup";
import { MonthCard } from "./MonthCard";
import { MonthSwitcher } from "./MonthSwitcher";
import { TradeForm } from "./TradeForm";
import { TradeHistory } from "./TradeHistory";
import { CloseMonthModal } from "./CloseMonthModal";
import type { Trade } from "@/lib/types";

export function Dashboard() {
  const {
    hydrated,
    state,
    activeMonth,
    tradesForActive,
    createMonth,
    selectMonth,
    deleteMonth,
    closeMonth,
    reopenMonth,
    addTrade,
    updateTrade,
    deleteTrade,
    resetAll,
    loadSample,
  } = useTradingData();

  const [showNewMonth, setShowNewMonth] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  const hasMonths = state.months.length > 0;
  const monthClosed = activeMonth?.isClosed ?? false;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border-subtle bg-bg-base/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold">
              T
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">Trade Journal</h1>
              <p className="text-xs text-gray-400 truncate">
                Manual stock & options tracker
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                if (
                  confirm(
                    "Reset ALL data? This deletes every month and trade from local storage."
                  )
                ) {
                  resetAll();
                }
              }}
              className="text-xs text-gray-400 hover:text-red-300"
              title="Reset all local data"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {hasMonths && (
          <MonthSwitcher
            months={state.months}
            activeId={state.activeMonthId}
            onSelect={(id) => {
              selectMonth(id);
              setShowNewMonth(false);
              setEditing(null);
            }}
            onNew={() => setShowNewMonth(true)}
          />
        )}

        {(!hasMonths || showNewMonth) && (
          <MonthSetup
            onCreate={(name, balance, notes) => {
              createMonth(name, balance, notes);
              setShowNewMonth(false);
            }}
            onLoadSample={!hasMonths ? loadSample : undefined}
            showSample={!hasMonths}
          />
        )}

        {activeMonth && (
          <>
            <MonthCard
              month={activeMonth}
              trades={tradesForActive}
              onCloseMonth={() => setConfirmClose(true)}
              onReopenMonth={() => reopenMonth(activeMonth.id)}
              onDelete={() => deleteMonth(activeMonth.id)}
            />

            <div className="space-y-5">
              {!monthClosed ? (
                <TradeForm
                  monthId={activeMonth.id}
                  availableBalance={activeMonth.currentBalance}
                  initialTrade={editing ?? undefined}
                  onSubmit={(data) => {
                    if (editing) {
                      updateTrade(editing.id, data);
                      setEditing(null);
                    } else {
                      addTrade(data);
                    }
                  }}
                  onCancel={editing ? () => setEditing(null) : undefined}
                  disabled={monthClosed}
                />
              ) : (
                <div className="card">
                  <h2 className="text-lg font-semibold mb-1">Month closed</h2>
                  <p className="text-sm text-gray-400 mb-3">
                    Trades are read-only. Reopen the month to make changes.
                  </p>
                  <button
                    onClick={() => reopenMonth(activeMonth.id)}
                    className="btn-ghost"
                  >
                    Reopen month
                  </button>
                </div>
              )}
              <TradeHistory
                trades={tradesForActive}
                readOnly={monthClosed}
                onEdit={(t) => {
                  setEditing(t);
                  if (typeof window !== "undefined") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                onDelete={(t) => deleteTrade(t.id)}
              />
            </div>
          </>
        )}

        <footer className="text-center text-xs text-gray-500 pt-6 pb-2">
          Data saved locally in your browser. Not financial advice.
        </footer>
      </main>

      {confirmClose && activeMonth && (
        <CloseMonthModal
          month={activeMonth}
          trades={tradesForActive}
          onConfirm={() => {
            closeMonth(activeMonth.id);
            setConfirmClose(false);
          }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </div>
  );
}
