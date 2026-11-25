"use client";

import {
  DELIVERY_PERIOD_IDS,
  DELIVERY_PERIODS,
  WEEKDAY_LABELS,
  type DeliveryPeriod,
  type DeliverySchedule,
} from "@frescari/api/delivery-slots";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/trpc/react";

const LEAD_OPTIONS = [
  { value: 0, label: "No mesmo dia" },
  { value: 1, label: "1 dia antes" },
  { value: 2, label: "2 dias antes" },
  { value: 3, label: "3 dias antes" },
];

// Shown in the week order a producer reads (Monday first).
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function DeliveryScheduleSection() {
  const farmQuery = trpc.farm.getCurrent.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const farm = farmQuery.data;

  return (
    <section className="rounded-[24px_18px_22px_18px] border border-soil/8 bg-cream p-6 shadow-card">
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
        Janela de entrega
      </p>
      <h2 className="mt-2 font-display text-2xl font-black text-soil">
        Quando voce entrega
      </h2>
      <p className="mt-2 font-sans text-sm leading-relaxed text-bark">
        O comprador escolhe um destes dias e periodos ao fechar o pedido.
      </p>

      {farmQuery.isLoading ? (
        <div className="mt-5 h-40 animate-pulse rounded-sm bg-soil/10" />
      ) : !farm ? (
        <p className="mt-5 rounded-sm border border-soil/10 bg-white p-4 font-sans text-sm text-bark">
          Salve a localizacao da fazenda primeiro. Depois voce define os dias de
          entrega aqui.
        </p>
      ) : (
        <DeliveryScheduleForm
          key={JSON.stringify(farm.deliverySchedule)}
          initial={farm.deliverySchedule}
        />
      )}
    </section>
  );
}

function DeliveryScheduleForm({
  initial,
}: {
  initial: DeliverySchedule & { isDefault: boolean };
}) {
  const utils = trpc.useUtils();
  const [days, setDays] = useState<number[]>(initial.days);
  const [periods, setPeriods] = useState<DeliveryPeriod[]>(initial.periods);
  const [leadDays, setLeadDays] = useState(initial.leadDays);

  const save = trpc.farm.saveDeliverySchedule.useMutation({
    onSuccess: async () => {
      toast.success("Dias de entrega salvos.");
      await utils.farm.getCurrent.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleDay = (day: number) =>
    setDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day],
    );
  const togglePeriod = (period: DeliveryPeriod) =>
    setPeriods((current) =>
      current.includes(period)
        ? current.filter((value) => value !== period)
        : [...current, period],
    );

  const isDirty =
    initial.isDefault ||
    leadDays !== initial.leadDays ||
    [...days].sort().join() !== [...initial.days].sort().join() ||
    [...periods].sort().join() !== [...initial.periods].sort().join();
  const isValid = days.length > 0 && periods.length > 0;

  const chipClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 font-sans text-sm font-semibold transition-colors ${
      active
        ? "border-forest bg-forest text-cream"
        : "border-soil/15 bg-white text-bark hover:border-forest/40"
    }`;

  return (
    <form
      className="mt-5 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ days, periods, leadDays });
      }}
    >
      {initial.isDefault ? (
        <p className="rounded-sm border border-amber-300/60 bg-amber-50 px-3 py-2 font-sans text-xs text-amber-900">
          Usando o padrao (segunda a sabado, manha e tarde). Ajuste e salve para
          valer o seu.
        </p>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-bark/70">
          Dias
        </legend>
        <div className="flex flex-wrap gap-2">
          {WEEK_ORDER.map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={days.includes(day)}
              onClick={() => toggleDay(day)}
              className={chipClass(days.includes(day))}
            >
              {WEEKDAY_LABELS[day]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-bark/70">
          Periodos
        </legend>
        <div className="flex flex-wrap gap-2">
          {DELIVERY_PERIOD_IDS.map((period) => {
            const { label, startHour, endHour } = DELIVERY_PERIODS[period];
            return (
              <button
                key={period}
                type="button"
                aria-pressed={periods.includes(period)}
                onClick={() => togglePeriod(period)}
                className={chipClass(periods.includes(period))}
              >
                {label} ({startHour}h–{endHour}h)
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block space-y-2">
        <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-bark/70">
          Antecedencia do pedido
        </span>
        <select
          value={leadDays}
          onChange={(event) => setLeadDays(Number(event.target.value))}
          className="w-full rounded-sm border border-soil/15 bg-white px-3 py-2 font-sans text-sm text-soil"
        >
          {LEAD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {!isValid ? (
        <p className="font-sans text-xs text-red-700">
          Escolha pelo menos um dia e um periodo.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!isValid || !isDirty || save.isPending}
        className="w-full rounded-sm bg-forest px-4 py-2.5 font-sans text-sm font-bold uppercase tracking-wider text-cream transition-opacity hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {save.isPending ? "Salvando..." : "Salvar dias de entrega"}
      </button>
    </form>
  );
}
