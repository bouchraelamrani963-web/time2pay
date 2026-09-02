"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";

type DeleteClientButtonProps = {
  clientId: string;
  clientName: string;
};

type DeleteClientResponse = {
  error?: unknown;
  message?: unknown;
};

async function readDeleteResponse(response: Response): Promise<DeleteClientResponse> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") return body as DeleteClientResponse;
  } catch {
    return {};
  }

  return {};
}

function getDeleteErrorMessage(status: number, body: DeleteClientResponse) {
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (typeof body.error === "string" && body.error.trim()) return body.error;
  if (status === 401) return "Je sessie is verlopen. Log opnieuw in.";
  if (status === 404) return "Klant niet gevonden.";
  return "Klant verwijderen mislukt.";
}

export default function DeleteClientButton({ clientId, clientName }: DeleteClientButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function deleteClient() {
    const confirmed = window.confirm(
      `Weet je zeker dat je klant "${clientName}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      const response = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });

      if (!response.ok) {
        const body = await readDeleteResponse(response);
        throw new Error(getDeleteErrorMessage(response.status, body));
      }

      toast.success("Klant verwijderd");
      router.push("/clients");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Klant verwijderen mislukt.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button type="button" className="btn-danger" disabled={deleting} onClick={deleteClient}>
      <Trash2 size={15} /> {deleting ? "Verwijderen..." : "Klant verwijderen"}
    </button>
  );
}
