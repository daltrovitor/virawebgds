// Hello World
"use client";

import { useState } from "react";
import { adminResetLinkAction, createRoleAction, inviteMemberAction, revokeInvitationAction, updateMemberAction, updateRolePermissionsAction } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useAction } from "@/components/ui/use-action";
import { PERMISSION_GROUPS, PERMISSION_LABEL, type Permission } from "@/domain/permissions";

interface Member {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  status: string;
  roleId: string;
  roleName: string;
  roleKey: string;
  lastLoginAt: string | null;
  mfaEnabled: boolean;
}
interface Role {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissions: Permission[];
}

export function UsersManager({ members, roles, invitations, currentUserId }: { members: Member[]; roles: Role[]; invitations: { id: string; email: string; name: string; roleName: string; expiresAt: string }[]; currentUserId: string }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", name: "", roleId: roles.find((r) => r.key === "reception")?.id ?? roles[0]?.id ?? "" });
  const [shareLink, setShareLink] = useState<{ title: string; link: string; note: string } | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [roleEdit, setRoleEdit] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const inviteA = useAction(inviteMemberAction, { success: "Convite criado" });
  const revoke = useAction(revokeInvitationAction, { success: "Convite revogado" });
  const update = useAction(updateMemberAction, { success: "Acesso atualizado" });
  const perms = useAction(updateRolePermissionsAction, { success: "Permissões do papel atualizadas" });
  const createRole = useAction(createRoleAction, { success: "Papel criado" });
  const reset = useAction(adminResetLinkAction, { refresh: false });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Usuários da clínica" actions={<Button size="sm" variant="primary" onClick={() => setInviteOpen(true)}>Convidar usuário</Button>} />
        <TableWrap label="Usuários">
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Papel</Th>
                <Th>Situação</Th>
                <Th>Último acesso</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <Tr key={m.membershipId}>
                  <Td>
                    <span className="font-medium">{m.name}</span>
                    <span className="block text-xs text-subtle">{m.email}</span>
                  </Td>
                  <Td>
                    {m.roleName} {m.mfaEnabled ? <Badge tone="success">MFA</Badge> : null}
                  </Td>
                  <Td>{m.status === "active" ? <Badge tone="success">Ativo</Badge> : <Badge>Suspenso</Badge>}</Td>
                  <Td className="tabular text-muted">{m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString("pt-BR") : "—"}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditMember({ ...m })}>
                        Alterar acesso
                      </Button>
                      {m.userId !== currentUserId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={reset.pending}
                          onClick={async () => {
                            const res = await reset.run(m.membershipId);
                            if (res.ok) setShareLink({ title: `Redefinição de senha — ${m.name}`, link: res.data.link, note: "Válido por 1 hora e uso único. Envie por um canal seguro." });
                          }}
                        >
                          Link de senha
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {invitations.length > 0 ? (
          <div className="border-t border-border px-4 py-3 sm:px-5">
            <p className="mb-2 text-sm font-medium">Convites pendentes</p>
            <ul className="space-y-1 text-sm">
              {invitations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {i.name} ({i.email}) · {i.roleName} · expira {new Date(i.expiresAt).toLocaleDateString("pt-BR")}
                  </span>
                  <Button size="sm" variant="ghost" loading={revoke.pending} onClick={() => revoke.run(i.id)}>
                    Revogar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Papéis e permissões"
          description="O papel de administrador mantém todas as permissões. Contador não recebe acesso a imagens ou anamnese por padrão."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="new-role" className="sr-only">
                Nome do novo papel
              </label>
              <input id="new-role" placeholder="Novo papel" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} className="h-9 rounded-md border border-border-strong px-2 text-sm" />
              <Button
                size="sm"
                disabled={!newRoleName.trim()}
                loading={createRole.pending}
                onClick={async () => {
                  const res = await createRole.run({ name: newRoleName });
                  if (res.ok) setNewRoleName("");
                }}
              >
                Criar papel
              </Button>
            </div>
          }
        />
        <ul className="divide-y divide-border">
          {roles.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-5">
              <span>
                <span className="font-medium">{r.name}</span> {r.isSystem ? <Badge>Padrão</Badge> : <Badge tone="info">Personalizado</Badge>}
                <span className="block text-xs text-subtle">{r.permissions.length} permissão(ões)</span>
              </span>
              {r.key !== "owner" ? (
                <Button size="sm" variant="ghost" onClick={() => setRoleEdit({ ...r })}>
                  Editar permissões
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Convidar usuário"
        description="O convite vale por 7 dias. Se o e-mail não estiver configurado, compartilhe o link exibido."
        footer={
          <Button
            variant="primary"
            loading={inviteA.pending}
            onClick={async () => {
              const res = await inviteA.run(invite);
              if (res.ok) {
                setInviteOpen(false);
                setShareLink({ title: "Link do convite", link: res.data.link, note: res.data.emailSent ? "E-mail enviado. O link abaixo também funciona." : "E-mail não configurado: envie o link por um canal seguro." });
                setInvite({ ...invite, email: "", name: "" });
              }
            }}
          >
            Criar convite
          </Button>
        }
      >
        <div className="space-y-4">
          {inviteA.error ? <Notice tone="danger">{inviteA.error}</Notice> : null}
          <Field label="Nome" htmlFor="iv-name" required>
            <Input id="iv-name" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
          </Field>
          <Field label="E-mail" htmlFor="iv-email" required error={inviteA.fieldErrors.email}>
            <Input id="iv-email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
          </Field>
          <Field label="Papel" htmlFor="iv-role">
            <Select id="iv-role" value={invite.roleId} onChange={(e) => setInvite({ ...invite, roleId: e.target.value })}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>

      {shareLink ? (
        <Dialog open onClose={() => setShareLink(null)} title={shareLink.title} description={shareLink.note}>
          <div className="flex gap-2">
            <Input readOnly value={shareLink.link} aria-label="Link" onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={() => void navigator.clipboard?.writeText(shareLink.link)}>Copiar</Button>
          </div>
        </Dialog>
      ) : null}

      {editMember ? (
        <Dialog
          open
          onClose={() => setEditMember(null)}
          title={`Acesso de ${editMember.name}`}
          footer={
            <Button
              variant="primary"
              loading={update.pending}
              onClick={async () => {
                const res = await update.run({ membershipId: editMember.membershipId, roleId: editMember.roleId, status: editMember.status as "active" | "suspended" });
                if (res.ok) setEditMember(null);
              }}
            >
              Salvar
            </Button>
          }
        >
          <div className="space-y-4">
            {update.error ? <Notice tone="danger">{update.error}</Notice> : null}
            <Field label="Papel" htmlFor="em-role">
              <Select id="em-role" value={editMember.roleId} onChange={(e) => setEditMember({ ...editMember, roleId: e.target.value })}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Situação" htmlFor="em-status">
              <Select id="em-status" value={editMember.status} onChange={(e) => setEditMember({ ...editMember, status: e.target.value })}>
                <option value="active">Ativo</option>
                <option value="suspended">Suspenso</option>
              </Select>
            </Field>
          </div>
        </Dialog>
      ) : null}

      {roleEdit ? (
        <Dialog
          open
          onClose={() => setRoleEdit(null)}
          title={`Permissões: ${roleEdit.name}`}
          size="lg"
          footer={
            <Button
              variant="primary"
              loading={perms.pending}
              onClick={async () => {
                const res = await perms.run({ roleId: roleEdit.id, permissions: roleEdit.permissions });
                if (res.ok) setRoleEdit(null);
              }}
            >
              Salvar permissões
            </Button>
          }
        >
          <div className="space-y-4">
            {perms.error ? <Notice tone="danger">{perms.error}</Notice> : null}
            {PERMISSION_GROUPS.map((g) => (
              <fieldset key={g.label}>
                <legend className="mb-1 text-sm font-semibold">{g.label}</legend>
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                  {g.permissions.map((p) => (
                    <label key={p} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-accent"
                        checked={roleEdit.permissions.includes(p)}
                        onChange={(e) => setRoleEdit({ ...roleEdit, permissions: e.target.checked ? [...roleEdit.permissions, p] : roleEdit.permissions.filter((x) => x !== p) })}
                      />
                      {PERMISSION_LABEL[p]}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
