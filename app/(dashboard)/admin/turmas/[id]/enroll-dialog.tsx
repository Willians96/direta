"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  enrollStudentAction,
  type ActionState,
} from "@/lib/actions/classes";

interface EnrollDialogProps {
  classId: string;
  leads: Array<{ id: string; fullName: string }>;
}

export function EnrollDialog({ classId, leads }: EnrollDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [leadId, setLeadId] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && leads.length > 0 && !leadId) {
      setLeadId(leads[0].id);
    }
  }, [open, leads, leadId]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("classId", classId);
    fd.append("leadId", leadId);
    if (notes) fd.append("notes", notes);

    startTransition(async () => {
      const r = await enrollStudentAction({} as ActionState, fd);
      if (r.ok) {
        toast.success(r.message ?? "Aluno matriculado!");
        setOpen(false);
        setNotes("");
      } else {
        toast.error(r.error ?? "Erro");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Matricular aluno
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Matricular aluno na turma</DialogTitle>
          <DialogDescription>
            Selecione um lead aprovado para adicionar à turma.
          </DialogDescription>
        </DialogHeader>
        {leads.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum lead aprovado disponível pra matricular.
            Aprove leads na fila primeiro.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Aluno</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observação (opcional)</Label>
              <Textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || !leadId}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Matricular
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
