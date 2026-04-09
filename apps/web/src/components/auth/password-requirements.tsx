"use client";

import { Check, X } from "lucide-react";

export type PasswordRequirementItem = {
  key: string;
  met: boolean;
  text: string;
};

type PasswordRequirementsProps = {
  items: PasswordRequirementItem[];
};

function PasswordRequirementRow({
  met,
  text,
}: Omit<PasswordRequirementItem, "key">) {
  return (
    <li
      className="flex items-center gap-2.5 font-sans text-sm leading-6"
      data-met={met}
    >
      {met ? (
        <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-forest" />
      ) : (
        <X aria-hidden="true" className="h-4 w-4 shrink-0 text-bark/34" />
      )}
      <span className={met ? "font-medium text-forest" : "text-bark/58"}>
        {text}
      </span>
    </li>
  );
}

export function PasswordRequirements({ items }: PasswordRequirementsProps) {
  return (
    <div
      aria-live="polite"
      className="rounded-[18px] border border-soil/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(249,246,240,0.82))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]"
    >
      <ul className="space-y-1.5">
        {items.map((item) => (
          <PasswordRequirementRow
            key={item.key}
            met={item.met}
            text={item.text}
          />
        ))}
      </ul>
    </div>
  );
}
