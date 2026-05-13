"use client";

import { Trash2 } from "lucide-react";
import { ITEM_TYPE_LABELS, type ItemType } from "@/types/invoice";
import { defaultUnit, calcLineTotal } from "@/lib/calculations";

export interface DraftItem {
  id: string;
  type: ItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
}

interface Props {
  item: DraftItem;
  index: number;
  onChange: (id: string, field: keyof DraftItem, value: string | number) => void;
  onRemove: (id: string) => void;
}

const ITEM_TYPES: ItemType[] = ["HOURS", "M2", "MATERIAL", "FIXED"];

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

export default function InvoiceItemRow({ item, index, onChange, onRemove }: Props) {
  const lineTotal = calcLineTotal({
    type: item.type,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    unit: item.unit,
  });

  const isFixed = item.type === "FIXED";

  return (
    <tr className="group border-b border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2 text-xs text-gray-400 w-8">{index + 1}</td>

      <td className="px-2 py-2 w-32">
        <select
          className="input text-xs"
          value={item.type}
          onChange={(e) => {
            const t = e.target.value as ItemType;
            onChange(item.id, "type", t);
            onChange(item.id, "unit", defaultUnit(t));
          }}
        >
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>{ITEM_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </td>

      <td className="px-2 py-2">
        <input
          className="input text-xs"
          placeholder="Omschrijving"
          value={item.description}
          onChange={(e) => onChange(item.id, "description", e.target.value)}
        />
      </td>

      <td className="px-2 py-2 w-24">
        <input
          className={`input text-xs text-right ${isFixed ? "opacity-40 pointer-events-none" : ""}`}
          type="number"
          min="0"
          step="0.01"
          value={isFixed ? "" : item.quantity}
          placeholder={isFixed ? "—" : "0"}
          readOnly={isFixed}
          onChange={(e) => onChange(item.id, "quantity", parseFloat(e.target.value) || 0)}
        />
      </td>

      <td className="px-2 py-2 w-20">
        <input
          className={`input text-xs text-center ${isFixed ? "opacity-40 pointer-events-none" : ""}`}
          placeholder="eenheid"
          value={isFixed ? "" : item.unit}
          readOnly={isFixed}
          onChange={(e) => onChange(item.id, "unit", e.target.value)}
        />
      </td>

      <td className="px-2 py-2 w-28">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
          <input
            className="input pl-5 text-xs text-right"
            type="number"
            min="0"
            step="0.01"
            value={item.unitPrice || ""}
            placeholder="0,00"
            onChange={(e) => onChange(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
          />
        </div>
      </td>

      <td className="px-3 py-2 w-28 text-right text-sm font-semibold text-gray-800">
        {formatEuro(lineTotal)}
      </td>

      <td className="px-2 py-2 w-8">
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="hidden group-hover:flex items-center justify-center rounded text-red-400 hover:text-red-600 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}
