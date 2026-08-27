'use client';

import { useMemo, useState } from 'react';
import { HardHat, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { Card, EmptyHint, SectionShell, Stat } from './SectionShell';
import { Button } from '@/components/ui/Button';
import { fieldControlClass } from '@/components/ui/Field';
import { formatCurrency } from '@/lib/format';
import { salariesTotalForEmployee } from '@/lib/projects';
import { useProjectsStore } from '@/lib/projects-store';
import { sumMoney } from '@/lib/format';

/**
 * Salarios: los equipos de obra y el registro de pagos a cada empleado,
 * imputables a un proyecto para que salgan en su balance.
 */
export function SalariesSection() {
  const teams = useProjectsStore((state) => state.teams);
  const projects = useProjectsStore((state) => state.projects);
  const salaryPayments = useProjectsStore((state) => state.salaryPayments);
  const createTeam = useProjectsStore((state) => state.createTeam);
  const deleteTeam = useProjectsStore((state) => state.deleteTeam);
  const addEmployee = useProjectsStore((state) => state.addEmployee);
  const removeEmployee = useProjectsStore((state) => state.removeEmployee);
  const addSalaryPayment = useProjectsStore((state) => state.addSalaryPayment);
  const removeSalaryPayment = useProjectsStore((state) => state.removeSalaryPayment);

  const [teamName, setTeamName] = useState('');
  const [newEmployee, setNewEmployee] = useState<Record<string, string>>({});

  const [payTeamId, setPayTeamId] = useState('');
  const [payEmployeeId, setPayEmployeeId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payProjectId, setPayProjectId] = useState('');
  const [payNote, setPayNote] = useState('');

  const payTeam = teams.find((team) => team.id === payTeamId) ?? null;
  const totalPaid = useMemo(
    () => sumMoney(salaryPayments.map((payment) => payment.amount)),
    [salaryPayments],
  );

  function registerPayment() {
    const employee = payTeam?.employees.find((entry) => entry.id === payEmployeeId);
    const amount = Number(payAmount.replace(',', '.'));
    if (!payTeam || !employee || !Number.isFinite(amount) || amount <= 0) return;

    addSalaryPayment({
      employeeId: employee.id,
      employeeName: employee.name,
      teamId: payTeam.id,
      projectId: payProjectId || null,
      amount: Math.round(amount * 100) / 100,
      note: payNote.trim() || null,
    });
    setPayAmount('');
    setPayNote('');
  }

  return (
    <SectionShell
      icon={<HardHat className="size-5" aria-hidden />}
      title="Salarios"
      subtitle="Crea tu equipo, registra cada pago a los obreros y contrólalo todo por empleado y por proyecto."
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Equipos" value={String(teams.length)} />
        <Stat
          label="Empleados"
          value={String(teams.reduce((count, team) => count + team.employees.length, 0))}
        />
        <Stat label="Total pagado" value={formatCurrency(totalPaid)} tone="brand" />
      </div>

      <Card>
        <h3 className="flex items-center gap-2 text-sm font-bold text-suma-ink">
          <Users className="size-4 text-suma-muted" aria-hidden />
          Equipos
        </h3>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && createTeam(teamName)) setTeamName('');
            }}
            placeholder="Nombre del equipo: «Cuadrilla de albañilería»"
            className={fieldControlClass}
          />
          <Button
            onClick={() => {
              if (createTeam(teamName)) setTeamName('');
            }}
            disabled={!teamName.trim()}
            icon={<Plus className="size-4" aria-hidden />}
            className="shrink-0"
          >
            Crear equipo
          </Button>
        </div>

        {teams.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-suma-border px-3 py-2 text-[11px] text-suma-muted">
            Crea un equipo y añade a tus empleados para empezar a registrar pagos.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {teams.map((team) => (
              <div key={team.id} className="rounded-lg bg-suma-canvas p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-suma-ink">{team.name}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar el equipo «${team.name}»?`)) {
                        deleteTeam(team.id);
                      }
                    }}
                    className="rounded-md p-1 text-suma-muted hover:bg-suma-red-tint hover:text-suma-danger"
                    aria-label={`Eliminar el equipo ${team.name}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {team.employees.map((employee) => (
                    <span
                      key={employee.id}
                      className="inline-flex items-center gap-1 rounded-full bg-suma-high py-1 pr-1 pl-2.5 text-[11px] font-semibold text-suma-ink ring-1 ring-suma-border ring-inset"
                      title={`Pagado hasta hoy: ${formatCurrency(
                        salariesTotalForEmployee(salaryPayments, employee.id),
                      )}`}
                    >
                      {employee.name}
                      <span className="text-suma-muted tabular-nums">
                        {formatCurrency(salariesTotalForEmployee(salaryPayments, employee.id))}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEmployee(team.id, employee.id)}
                        className="rounded-full p-0.5 text-suma-muted hover:bg-suma-red-tint hover:text-suma-danger"
                        aria-label={`Quitar a ${employee.name}`}
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="mt-2 flex gap-2">
                  <input
                    value={newEmployee[team.id] ?? ''}
                    onChange={(event) =>
                      setNewEmployee((state) => ({ ...state, [team.id]: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        addEmployee(team.id, newEmployee[team.id] ?? '');
                        setNewEmployee((state) => ({ ...state, [team.id]: '' }));
                      }
                    }}
                    placeholder="Nombre del empleado"
                    className={fieldControlClass}
                  />
                  <Button
                    variant="neutral"
                    size="sm"
                    className="h-auto shrink-0"
                    onClick={() => {
                      addEmployee(team.id, newEmployee[team.id] ?? '');
                      setNewEmployee((state) => ({ ...state, [team.id]: '' }));
                    }}
                    disabled={!(newEmployee[team.id] ?? '').trim()}
                    icon={<UserPlus className="size-3.5" aria-hidden />}
                  >
                    Añadir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-suma-ink">Registrar un pago</h3>

        {teams.every((team) => team.employees.length === 0) ? (
          <p className="mt-2 text-xs text-suma-muted">
            Añade empleados a un equipo para poder registrar sus pagos.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              value={payTeamId}
              onChange={(event) => {
                setPayTeamId(event.target.value);
                setPayEmployeeId('');
              }}
              className={fieldControlClass}
            >
              <option value="">Equipo…</option>
              {teams
                .filter((team) => team.employees.length > 0)
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
            </select>

            <select
              value={payEmployeeId}
              onChange={(event) => setPayEmployeeId(event.target.value)}
              disabled={!payTeam}
              className={fieldControlClass}
            >
              <option value="">Empleado…</option>
              {payTeam?.employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>

            <div className="relative">
              <input
                value={payAmount}
                onChange={(event) => setPayAmount(event.target.value)}
                inputMode="decimal"
                placeholder="Importe"
                className={`${fieldControlClass} pr-8 tabular-nums`}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-suma-muted">
                €
              </span>
            </div>

            <select
              value={payProjectId}
              onChange={(event) => setPayProjectId(event.target.value)}
              className={fieldControlClass}
            >
              <option value="">Sin proyecto (gasto general)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  Imputar a: {project.name}
                </option>
              ))}
            </select>

            <input
              value={payNote}
              onChange={(event) => setPayNote(event.target.value)}
              placeholder="Nota: «semana 12-16 agosto» (opcional)"
              className={`${fieldControlClass} sm:col-span-2`}
            />

            <Button
              onClick={registerPayment}
              disabled={!payEmployeeId || !(Number(payAmount.replace(',', '.')) > 0)}
              icon={<Plus className="size-4" aria-hidden />}
              className="sm:col-span-2"
            >
              Registrar pago
            </Button>
          </div>
        )}
      </Card>

      {salaryPayments.length > 0 ? (
        <Card>
          <h3 className="text-sm font-bold text-suma-ink">Historial de pagos</h3>
          <ul className="mt-2 divide-y divide-suma-border-soft">
            {salaryPayments.map((payment) => {
              const project = projects.find((entry) => entry.id === payment.projectId);
              return (
                <li key={payment.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-suma-ink">
                      {payment.employeeName}
                      {project ? (
                        <span className="font-normal text-suma-muted"> · {project.name}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-suma-muted">
                      {new Intl.DateTimeFormat('es-ES', {
                        dateStyle: 'medium',
                      }).format(new Date(payment.date))}
                      {payment.note ? ` · ${payment.note}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-suma-ink tabular-nums">
                    {formatCurrency(payment.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSalaryPayment(payment.id)}
                    className="rounded-md p-1 text-suma-muted hover:bg-suma-red-tint hover:text-suma-danger"
                    aria-label="Eliminar este pago"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <EmptyHint>
          Aún no hay pagos registrados. Cada pago queda en el historial y suma en la ficha del
          empleado; si lo imputas a un proyecto, aparecerá también en su balance.
        </EmptyHint>
      )}
    </SectionShell>
  );
}
