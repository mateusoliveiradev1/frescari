"use client";

import { useState } from "react";

import { calculateSellingPrice, parseBrazilianNumber } from "@/lib/free-tools";

import { formatBrl, ToolField } from "../tool-page-parts";

export function MarginCalculator() {
  const [purchaseCost, setPurchaseCost] = useState("5,00");
  const [lossPercent, setLossPercent] = useState("10");
  const [extraCost, setExtraCost] = useState("0,40");
  const [marginPercent, setMarginPercent] = useState("30");

  const result = calculateSellingPrice({
    purchaseCost: parseBrazilianNumber(purchaseCost) ?? 0,
    lossPercent: parseBrazilianNumber(lossPercent) ?? 0,
    extraCostPerUnit: parseBrazilianNumber(extraCost) ?? 0,
    marginPercent: parseBrazilianNumber(marginPercent) ?? 0,
  });

  return (
    <div className="grid gap-6 rounded-[24px] border border-soil/10 bg-white p-6 shadow-sm md:grid-cols-2 md:p-8">
      <div className="flex flex-col gap-5">
        <ToolField
          id="custo"
          label="Custo de compra"
          hint="Quanto você paga por kg, caixa ou unidade."
          suffix="R$"
          value={purchaseCost}
          onChange={setPurchaseCost}
        />
        <ToolField
          id="quebra"
          label="Quebra / perda"
          hint="Parte que estraga, murcha ou vai para o lixo antes de vender."
          suffix="%"
          value={lossPercent}
          onChange={setLossPercent}
        />
        <ToolField
          id="extra"
          label="Outros custos por unidade"
          hint="Embalagem, frete, mão de obra. Deixe 0 se não souber."
          suffix="R$"
          value={extraCost}
          onChange={setExtraCost}
        />
        <ToolField
          id="margem"
          label="Margem desejada"
          hint="Quanto do preço de venda fica com você."
          suffix="%"
          value={marginPercent}
          onChange={setMarginPercent}
        />
      </div>

      <div
        aria-live="polite"
        className="flex flex-col justify-center gap-4 rounded-[20px] bg-sage/30 p-6"
      >
        {result ? (
          <>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest">
                Preço de venda sugerido
              </p>
              <p className="font-display text-5xl font-black text-soil">
                {formatBrl(result.sellingPrice)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white p-3">
                <dt className="text-bark">Custo real por unidade vendida</dt>
                <dd className="font-bold text-soil">
                  {formatBrl(result.effectiveCost)}
                </dd>
              </div>
              <div className="rounded-xl bg-white p-3">
                <dt className="text-bark">Lucro por unidade</dt>
                <dd className="font-bold text-soil">
                  {formatBrl(result.profitPerUnit)}
                </dd>
              </div>
              <div className="col-span-2 rounded-xl bg-white p-3">
                <dt className="text-bark">Markup sobre o custo de compra</dt>
                <dd className="font-bold text-soil">
                  {result.markupPercent.toLocaleString("pt-BR")}%
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-bark">
            Preencha o custo de compra com um valor maior que zero. Quebra e
            margem precisam ficar abaixo de 100%.
          </p>
        )}
      </div>
    </div>
  );
}
