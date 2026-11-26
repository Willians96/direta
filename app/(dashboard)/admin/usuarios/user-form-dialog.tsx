"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Camera, Loader2, Plus, Pencil, UserCog, MapPin, IdCard, Phone } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  createUserAction,
  updateUserAction,
  uploadUserAvatarAction,
  type ActionState,
} from "@/lib/actions/users";

/**
 * Cadastro de colaboradores — tela ampliada com os campos do sistema antigo
 * (Código, Nome, Data Cadastro, Data Admissão, CPF, RG, Data Nascimento,
 * Endereço/Nº/Bairro/Cidade/Estado/CEP, Telefone, Celular, E-mail, Cargo,
 * Observações, Situação e Foto) + login e senha do sistema atual.
 */

const userSchema = z.object({
  fullName: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().optional(),
  role: z.enum(["ADMIN", "CAPTACAO", "VENDAS", "RECEPCAO"]),
  status: z.enum(["ATIVO", "INATIVO"]).optional(),
  phone: z.string().optional(),
  code: z.string().optional(),
  admissionDate: z.string().optional(),
  birthDate: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  mobile: z.string().optional(),
  jobTitle: z.string().optional(),
  addressStreet: z.string().optional(),
  addressNumber: z.string().optional(),
  addressDistrict: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZip: z.string().optional(),
  notes: z.string().optional(),
  showEnrollment: z.boolean(),
  // Referência da foto enviada ao storage antes do cadastro (tela de criação).
  avatarRef: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserFormDialogProps {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone: string | null;
    status: string;
    code?: string | null;
    admissionDate?: string | null;
    birthDate?: string | null;
    cpf?: string | null;
    rg?: string | null;
    mobile?: string | null;
    jobTitle?: string | null;
    addressStreet?: string | null;
    addressNumber?: string | null;
    addressDistrict?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressZip?: string | null;
    notes?: string | null;
    showEnrollment?: boolean;
    avatarUrl?: string | null;
    createdAt?: string | null;
  };
}

const CARGOS = [
  "Administrator",
  "Coordenador",
  "Professor",
  "Vendedor",
  "Recepcionista",
  "Auxiliar",
];

function paraInputDate(valor?: string | null): string {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function UserFormDialog({ user }: UserFormDialogProps) {
  const isEdit = !!user;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Pré-visualização da foto escolhida (object URL) — o banco só guarda a
  // referência do arquivo.
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: isEdit
      ? {
          fullName: user.name,
          email: user.email,
          role: user.role as any,
          phone: user.phone ?? "",
          status: user.status as any,
          code: user.code ?? "",
          admissionDate: paraInputDate(user.admissionDate),
          birthDate: paraInputDate(user.birthDate),
          cpf: user.cpf ?? "",
          rg: user.rg ?? "",
          mobile: user.mobile ?? "",
          jobTitle: user.jobTitle ?? "",
          addressStreet: user.addressStreet ?? "",
          addressNumber: user.addressNumber ?? "",
          addressDistrict: user.addressDistrict ?? "",
          addressCity: user.addressCity ?? "",
          addressState: user.addressState ?? "",
          addressZip: user.addressZip ?? "",
          notes: user.notes ?? "",
          showEnrollment: user.showEnrollment ?? true,
        }
      : {
          fullName: "",
          email: "",
          password: "",
          role: "VENDAS",
          phone: "",
          code: "",
          admissionDate: "",
          birthDate: "",
          cpf: "",
          rg: "",
          mobile: "",
          jobTitle: "",
          addressStreet: "",
          addressNumber: "",
          addressDistrict: "",
          addressCity: "",
          addressState: "",
          addressZip: "",
          notes: "",
          showEnrollment: true,
        },
  });

  const role = watch("role");
  const status = watch("status");
  const showEnrollment = watch("showEnrollment");

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = handleSubmit((data) => {
    if (!isEdit && (!data.password || data.password.length < 6)) {
      toast.error("Informe a senha inicial (mínimo 6 caracteres).");
      return;
    }

    const formData = new FormData();
    formData.append("fullName", data.fullName);
    formData.append("email", data.email);
    formData.append("role", data.role);
    if (data.password) formData.append("password", data.password);
    if (data.status) formData.append("status", data.status);
    formData.append("phone", data.phone ?? "");
    formData.append("code", data.code ?? "");
    formData.append("admissionDate", data.admissionDate ?? "");
    formData.append("birthDate", data.birthDate ?? "");
    formData.append("cpf", data.cpf ?? "");
    formData.append("rg", data.rg ?? "");
    formData.append("mobile", data.mobile ?? "");
    formData.append("jobTitle", data.jobTitle ?? "");
    formData.append("addressStreet", data.addressStreet ?? "");
    formData.append("addressNumber", data.addressNumber ?? "");
    formData.append("addressDistrict", data.addressDistrict ?? "");
    formData.append("addressCity", data.addressCity ?? "");
    formData.append("addressState", data.addressState ?? "");
    formData.append("addressZip", data.addressZip ?? "");
    formData.append("notes", data.notes ?? "");
    formData.append("showEnrollment", String(data.showEnrollment));
    if (data.avatarRef) formData.append("avatarRef", data.avatarRef);

    startTransition(async () => {
      const action = isEdit
        ? updateUserAction(user!.id, {} as ActionState, formData)
        : createUserAction({} as ActionState, formData);
      const result = await action;

      if (result.ok) {
        toast.success(result.message ?? "Salvo!");
        setOpen(false);
        reset();
      } else {
        toast.error(result.error ?? "Erro");
      }
    });
  });

  /** Envia a foto escolhida para o storage (equivalente ao "Localizar" da tela antiga). */
  async function enviarFoto(file: File) {
    setEnviandoFoto(true);
    try {
      const dados = new FormData();
      dados.append("file", file);

      const res = await uploadUserAvatarAction(isEdit ? user!.id : null, dados);

      if (!res.ok) {
        toast.error(res.error ?? "Erro ao enviar a foto.");
        return;
      }

      setFotoPreview(URL.createObjectURL(file));
      // Na criação, o cadastro ainda não existe: a referência vai no formulário
      // e é gravada junto com o colaborador.
      if (!isEdit && res.reference) {
        setValue("avatarRef", res.reference);
      }
      toast.success("Foto atualizada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar a foto.");
    } finally {
      setEnviandoFoto(false);
      if (inputFotoRef.current) inputFotoRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo usuário
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar colaborador" : "Novo colaborador"}
          </DialogTitle>
          <DialogDescription>
            Dados do colaborador e acesso ao sistema. A data de cadastro é gerada
            automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* DADOS DO COLABORADOR */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UserCog className="h-4 w-4 text-direta-orange" />
              Dados do colaborador
            </h3>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input id="code" placeholder="Ex: 000879" {...register("code")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="fullName">Nome do colaborador *</Label>
                <Input id="fullName" {...register("fullName")} />
                {errors.fullName && (
                  <p className="text-xs text-red-500">{errors.fullName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="createdAt">Data de cadastro</Label>
                <Input
                  id="createdAt"
                  readOnly
                  disabled
                  value={
                    user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("pt-BR")
                      : "Automática"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admissionDate">Data de admissão</Label>
                <Input
                  id="admissionDate"
                  type="date"
                  {...register("admissionDate")}
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="jobTitle">Cargo</Label>
                <Input
                  id="jobTitle"
                  list="cargos-lista"
                  placeholder="Ex: Vendedor"
                  {...register("jobTitle")}
                />
                <datalist id="cargos-lista">
                  {CARGOS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </section>

          {/* DOCUMENTOS */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <IdCard className="h-4 w-4 text-direta-orange" />
              Documentos
            </h3>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" placeholder="000.000.000-00" {...register("cpf")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rg">RG</Label>
                <Input id="rg" placeholder="00.000.000-0" {...register("rg")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input id="birthDate" type="date" {...register("birthDate")} />
              </div>
            </div>
          </section>

          {/* ENDEREÇO */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MapPin className="h-4 w-4 text-direta-orange" />
              Endereço
            </h3>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="addressStreet">Endereço</Label>
                <Input id="addressStreet" {...register("addressStreet")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressNumber">Nº</Label>
                <Input id="addressNumber" {...register("addressNumber")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressDistrict">Bairro</Label>
                <Input id="addressDistrict" {...register("addressDistrict")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressCity">Cidade</Label>
                <Input id="addressCity" {...register("addressCity")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressState">Estado</Label>
                <Input
                  id="addressState"
                  maxLength={2}
                  placeholder="SP"
                  {...register("addressState")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressZip">CEP</Label>
                <Input
                  id="addressZip"
                  placeholder="00000-000"
                  {...register("addressZip")}
                />
              </div>
              <div className="space-y-2">
                <Label>Foto</Label>
                <div className="flex items-center gap-3">
                  <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-md border bg-slate-50 text-[10px] text-slate-400">
                    {fotoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fotoPreview}
                        alt="Foto do colaborador"
                        className="h-full w-full object-cover"
                      />
                    ) : isEdit && user?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/users/avatar/${user!.id}`}
                        alt="Foto do colaborador"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      "FOTO"
                    )}
                  </div>
                  <div>
                    <input
                      ref={inputFotoRef}
                      id="foto"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) enviarFoto(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={enviandoFoto}
                      onClick={() => inputFotoRef.current?.click()}
                    >
                      {enviandoFoto ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Camera className="mr-2 h-3 w-3" />
                      )}
                      {user?.avatarUrl || fotoPreview ? "Trocar foto" : "Enviar foto"}
                    </Button>
                    <p className="mt-1 text-[11px] text-slate-400">
                      JPG, PNG, WEBP ou GIF, até 3 MB.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CONTATO */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Phone className="h-4 w-4 text-direta-orange" />
              Contato
            </h3>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(15) 3333-4444"
                  {...register("phone")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Celular</Label>
                <Input
                  id="mobile"
                  placeholder="(15) 99999-9999"
                  {...register("mobile")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail (login) *</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>
            </div>
          </section>

          {/* ACESSO E SITUAÇÃO */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Acesso e situação</h3>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select
                  value={role}
                  onValueChange={(v) =>
                    setValue("role", v as "ADMIN" | "CAPTACAO" | "VENDAS" | "RECEPCAO")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="CAPTACAO">Captação</SelectItem>
                    <SelectItem value="VENDAS">Vendas</SelectItem>
                    <SelectItem value="RECEPCAO">Recepção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Situação</Label>
                <Select
                  value={status ?? "ATIVO"}
                  onValueChange={(v) => setValue("status", v as "ATIVO" | "INATIVO")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="INATIVO">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!isEdit && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha inicial *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="mínimo 6 caracteres"
                    {...register("password")}
                  />
                  {(errors as any).password && (
                    <p className="text-xs text-red-500">
                      {(errors as any).password.message}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <input
                  id="showEnrollment"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-direta-orange"
                  checked={showEnrollment}
                  onChange={(e) => setValue("showEnrollment", e.target.checked)}
                />
                <Label htmlFor="showEnrollment" className="font-normal leading-snug">
                  Aparecer para efetuar matrícula
                </Label>
              </div>
            </div>
          </section>

          {/* OBSERVAÇÕES */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Observações</h3>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Anotações sobre o colaborador..."
              {...register("notes")}
            />
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar colaborador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
