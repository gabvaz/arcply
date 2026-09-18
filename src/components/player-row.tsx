"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Select } from "@/components/ui";
import { Spinner } from "@/components/pending-button";
import { deletePlayer, updatePlayer } from "@/lib/actions/players";
import type { Gender } from "@prisma/client";

export function PlayerRow({
  id,
  name,
  gender,
  contact,
}: {
  id: string;
  name: string;
  gender: Gender;
  contact: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <li className="surface rounded-3xl p-4 sm:p-5">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await updatePlayer(id, fd);
            if (res?.error) setError(res.error);
            else router.refresh();
          });
        }}
      >
        <div>
          <Label>Nome</Label>
          <Input name="name" defaultValue={name} required disabled={pending} />
        </div>
        <div>
          <Label htmlFor={`gender-${id}`}>Gênero</Label>
          <Select
            id={`gender-${id}`}
            name="gender"
            defaultValue={gender}
            required
            disabled={pending}
          >
            <option value="MALE">Masculino</option>
            <option value="FEMALE">Feminino</option>
          </Select>
        </div>
        <div>
          <Label>Contato</Label>
          <Input name="contact" defaultValue={contact ?? ""} disabled={pending} />
        </div>
        <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
          {pending ? (
            <>
              <Spinner />
              Salvando…
            </>
          ) : (
            "Salvar"
          )}
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={pending}
          aria-busy={pending}
          onClick={() => {
            if (
              !confirm(
                "Excluir jogador? Remove também duplas e jogos ligados a ele.",
              )
            ) {
              return;
            }
            setError(null);
            start(async () => {
              const res = await deletePlayer(id);
              if (res?.error) setError(res.error);
              else router.refresh();
            });
          }}
        >
          {pending ? (
            <>
              <Spinner />
              …
            </>
          ) : (
            "Excluir"
          )}
        </Button>
      </form>
      {error ? <p className="mt-2 text-sm font-medium text-coral">{error}</p> : null}
    </li>
  );
}
