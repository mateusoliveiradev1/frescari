"use client";

type Slot = { id: string; label: string };

// Delivery window and notes for one farm's order in the cart.
export function DeliveryWindowPicker({
  farmId,
  slots,
  isLoading,
  isError,
  value,
  onChange,
  notes,
  onNotesChange,
  weighed = false,
}: {
  farmId: string;
  slots: Slot[];
  isLoading: boolean;
  isError: boolean;
  value: string | null;
  onChange: (slotId: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  // Items sold by weight: windows are limited to what the card hold covers.
  weighed?: boolean;
}) {
  const selectId = `janela-${farmId}`;
  const notesId = `obs-${farmId}`;

  return (
    <div className="space-y-3 rounded-[24px] border border-forest/10 bg-white p-4">
      <div className="space-y-1.5">
        <label
          htmlFor={selectId}
          className="block font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/60"
        >
          Quando entregar
        </label>
        {isLoading ? (
          <div className="h-10 animate-pulse rounded-[14px] bg-forest/5" />
        ) : isError ? (
          <p className="text-sm text-red-700">
            Não foi possível carregar as janelas de entrega. Tente reabrir o
            carrinho.
          </p>
        ) : slots.length === 0 ? (
          <p className="rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {weighed
              ? "Itens vendidos por peso precisam ser entregues em até 6 dias, e este produtor não tem entregas nesse prazo."
              : "Este produtor não tem entregas disponíveis nas próximas 2 semanas."}
          </p>
        ) : (
          <select
            id={selectId}
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-[14px] border border-forest/15 bg-cream px-3 py-2.5 text-sm font-semibold text-soil focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
          >
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.label}
              </option>
            ))}
          </select>
        )}
        {weighed && slots.length > 0 ? (
          <p className="text-xs text-bark/70">
            Itens por peso: entrega em até 6 dias. O valor final e cobrado
            depois da pesagem, e a reserva no cartão vale 7 dias.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={notesId}
          className="block font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/60"
        >
          Observações para a entrega (opcional)
        </label>
        <input
          id={notesId}
          type="text"
          maxLength={500}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Ex.: entrada pelos fundos, falar com o Joao"
          className="w-full rounded-[14px] border border-forest/15 bg-cream px-3 py-2.5 text-sm text-soil placeholder:text-bark/40 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        />
      </div>
    </div>
  );
}
