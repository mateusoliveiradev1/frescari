"use client";

import { useState } from "react";

import { parseBrazilianNumber, simulateWaste } from "@/lib/free-tools";

import { formatBrl, ToolField } from "../tool-page-parts";

export function WasteSimulator() {
  const [weeklyPurchases, setWeeklyPurchases] = useState("3.000");
  const [lossPercent, setLossPercent] = useState("12");
  const [targetLossPercent, setTargetLossPercent] = useState("5");

  const result = simulateWaste({
    weeklyPurchases: parseBrazilianNumber(weeklyPurchases) ?? 0,
    lossPercent: parseBrazilianNumber(lossPercent) ?? 0,
    targetLossPercent: parseBrazilianNumber(targetLossPercent) ?? 0,
  });

  return (
    <div className="grid grid-cols-1 gap-6 rounded-[24px] border border-soil/10 bg-white p-4 shadow-sm sm:p-6 md:grid-cols-2 md:p-8">
      <div className="flex min-w-0 flex-col gap-5">
        <ToolField
          id="compras"
          label="Compras de hortifruti por semana"
          hint="Quanto você gasta, em média, com frutas, legumes e verduras."
          suffix="R$"
          value={weeklyPurchases}
          onChange={setWeeklyPurchases}
        />
        <ToolField
          id="perda"
          label="Desperdício hoje"
          hint="Parte do que você compra que acaba no lixo. Na dúvida, pese o descarte de uma semana."
          suffix="%"
          value={lossPercent}
          onChange={setLossPercent}
        />
        <ToolField
          id="meta"
          label="Meta de desperdício"
          hint="Onde você quer chegar."
          suffix="%"
          value={targetLossPercent}
          onChange={setTargetLossPercent}
        />
      </div>

      <div
        aria-live="polite"
        className="flex min-w-0 flex-col justify-center gap-4 rounded-[20px] bg-sage/30 p-4 sm:p-6"
      >
        {result ? (
          <>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest">
                Vai para o lixo por ano
              </p>
              <p className="break-words font-display text-[clamp(1.75rem,8.5vw,3rem)] font-black leading-tight text-soil">
                {formatBrl(result.yearlyLoss)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white p-3">
                <dt className="text-bark">Por semana</dt>
                <dd className="font-bold text-soil">
                  {formatBrl(result.weeklyLoss)}
                </dd>
              </div>
              <div className="rounded-xl bg-white p-3">
                <dt className="text-bark">Por mês</dt>
                <dd className="font-bold text-soil">
                  {formatBrl(result.monthlyLoss)}
                </dd>
              </div>
              <div className="col-span-2 rounded-xl bg-forest p-3 text-cream">
                <dt className="text-cream/80">
                  Economia por ano chegando à meta
                </dt>
                <dd className="font-display text-2xl font-black">
                  {formatBrl(result.yearlySavingsAtTarget)}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-bark">
            Preencha as compras da semana com um valor maior que zero. Os
            percentuais vão de 0 a 100.
          </p>
        )}
      </div>
    </div>
  );
}
