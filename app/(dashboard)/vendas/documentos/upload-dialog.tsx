"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Upload, FileText, FileImage, FileType2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  uploadDocumentAction,
  type ActionState,
} from "@/lib/actions/documents";

interface UploadDialogProps {
  leads: Array<{ id: string; fullName: string }>;
}

export function UploadDialog({ leads }: UploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [leadId, setLeadId] = useState<string>("");
  const [type, setType] = useState<string>("CPF");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open && leads.length > 0 && !leadId) {
      setLeadId(leads[0].id);
    }
  }, [open, leads, leadId]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }

    const fd = new FormData();
    fd.append("leadId", leadId);
    fd.append("type", type);
    if (description) fd.append("description", description);
    fd.append("file", file);

    startTransition(async () => {
      const r = await uploadDocumentAction({} as ActionState, fd);
      if (r.ok) {
        toast.success(r.message ?? "Enviado!");
        setOpen(false);
        form.reset();
        setDescription("");
      } else {
        toast.error(r.error ?? "Erro");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Enviar documento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar documento</DialogTitle>
          <DialogDescription>
            PDFs, imagens ou docs (máx. 10MB)
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Lead</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um lead" />
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
            <Label>Tipo de documento</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CPF">CPF</SelectItem>
                <SelectItem value="RG">RG</SelectItem>
                <SelectItem value="COMPROVANTE_RESIDENCIA">
                  Comprovante de residência
                </SelectItem>
                <SelectItem value="HISTORICO_ESCOLAR">
                  Histórico escolar
                </SelectItem>
                <SelectItem value="OUTRO">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Arquivo</Label>
            <Input
              id="file"
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input
              id="description"
              placeholder="Ex: Frente e verso"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <FileImage className="h-5 w-5" />;
  if (type.includes("pdf")) return <FileText className="h-5 w-5" />;
  return <FileType2 className="h-5 w-5" />;
}

export { FileIcon };
