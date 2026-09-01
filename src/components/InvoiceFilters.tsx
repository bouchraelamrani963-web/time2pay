"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

interface Props {
  clients: { id: string; name: string }[];
  initialQ: string;
  initialClientId: string;
}

export default function InvoiceFilters({ clients, initialQ, initialClientId }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [clientId, setClientId] = useState(initialClientId);

  useEffect(() => {
    setQ(initialQ);
    setClientId(initialClientId);
  }, [initialQ, initialClientId]);

  function apply(nextQ: string, nextClient: string) {
    const params = new URLSearchParams(window.location.search);
    if (nextQ) params.set("q", nextQ);
    else params.delete("q");
    if (nextClient) params.set("clientId", nextClient);
    else params.delete("clientId");

    const qs = params.toString();
    router.push(qs ? `/invoices?${qs}` : "/invoices");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    apply(q, clientId);
  }

  function reset() {
    setQ("");
    setClientId("");
    apply("", "");
  }

  const hasFilter = q || clientId;

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          className="input pl-9"
          placeholder="Zoek op factuurnummer of klant..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <select
        className="input max-w-[220px]"
        value={clientId}
        onChange={(e) => {
          setClientId(e.target.value);
          apply(q, e.target.value);
        }}
      >
        <option value="">Alle klanten</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <button type="submit" className="btn-secondary">
        Filter
      </button>
      {hasFilter && (
        <button type="button" onClick={reset} className="btn-secondary" title="Filters wissen">
          <X size={15} />
        </button>
      )}
    </form>
  );
}
