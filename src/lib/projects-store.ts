'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CollectionEntry,
  Project,
  SalaryPayment,
  SavedBudget,
  SupplierPayment,
  Team,
} from './types';

/**
 * Almacén de la parte de gestión: proyectos (con sus presupuestos guardados,
 * pagos y cobros), equipos y salarios. Vive en `localStorage`, igual que el
 * presupuesto en curso, bajo una clave propia para que borrar la conversación
 * jamás toque los proyectos.
 */

interface ProjectsState {
  projects: Project[];
  teams: Team[];
  salaryPayments: SalaryPayment[];
  hasHydrated: boolean;

  createProject: (name: string) => Project | null;
  renameProject: (projectId: string, name: string) => void;
  deleteProject: (projectId: string) => void;
  saveBudgetToProject: (projectId: string, budget: SavedBudget) => void;
  removeBudgetFromProject: (projectId: string, budgetId: string) => void;

  togglePaidLine: (projectId: string, lineId: string) => void;
  addExtraPayment: (projectId: string, payment: Omit<SupplierPayment, 'id' | 'date'>) => void;
  removeExtraPayment: (projectId: string, paymentId: string) => void;

  addCollection: (projectId: string, entry: Omit<CollectionEntry, 'id' | 'date'>) => void;
  removeCollection: (projectId: string, entryId: string) => void;

  createTeam: (name: string) => Team | null;
  deleteTeam: (teamId: string) => void;
  addEmployee: (teamId: string, name: string) => void;
  removeEmployee: (teamId: string, employeeId: string) => void;
  addSalaryPayment: (payment: Omit<SalaryPayment, 'id' | 'date'>) => void;
  removeSalaryPayment: (paymentId: string) => void;

  setHasHydrated: (value: boolean) => void;
}

function id(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set) => ({
      projects: [],
      teams: [],
      salaryPayments: [],
      hasHydrated: false,

      createProject(name) {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const project: Project = {
          id: id(),
          name: trimmed,
          createdAt: now(),
          budgets: [],
          paidLineIds: [],
          extraPayments: [],
          collections: [],
        };
        set((state) => ({ projects: [project, ...state.projects] }));
        return project;
      },

      renameProject(projectId, name) {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId ? { ...project, name: trimmed } : project,
          ),
        }));
      },

      deleteProject(projectId) {
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== projectId),
          salaryPayments: state.salaryPayments.map((payment) =>
            payment.projectId === projectId ? { ...payment, projectId: null } : payment,
          ),
        }));
      },

      saveBudgetToProject(projectId, budget) {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? { ...project, budgets: [budget, ...project.budgets] }
              : project,
          ),
        }));
      },

      removeBudgetFromProject(projectId, budgetId) {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const removed = project.budgets.find((budget) => budget.id === budgetId);
            const removedLineIds = new Set(removed?.lines.map((line) => line.id) ?? []);
            return {
              ...project,
              budgets: project.budgets.filter((budget) => budget.id !== budgetId),
              paidLineIds: project.paidLineIds.filter((lineId) => !removedLineIds.has(lineId)),
            };
          }),
        }));
      },

      togglePaidLine(projectId, lineId) {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const paid = new Set(project.paidLineIds);
            if (paid.has(lineId)) paid.delete(lineId);
            else paid.add(lineId);
            return { ...project, paidLineIds: [...paid] };
          }),
        }));
      },

      addExtraPayment(projectId, payment) {
        if (!(payment.amount > 0)) return;
        const entry: SupplierPayment = { ...payment, id: id(), date: now() };
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? { ...project, extraPayments: [entry, ...project.extraPayments] }
              : project,
          ),
        }));
      },

      removeExtraPayment(projectId, paymentId) {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  extraPayments: project.extraPayments.filter((entry) => entry.id !== paymentId),
                }
              : project,
          ),
        }));
      },

      addCollection(projectId, entry) {
        if (!(entry.amount > 0)) return;
        const record: CollectionEntry = { ...entry, id: id(), date: now() };
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? { ...project, collections: [record, ...project.collections] }
              : project,
          ),
        }));
      },

      removeCollection(projectId, entryId) {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  collections: project.collections.filter((entry) => entry.id !== entryId),
                }
              : project,
          ),
        }));
      },

      createTeam(name) {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const team: Team = { id: id(), name: trimmed, employees: [] };
        set((state) => ({ teams: [...state.teams, team] }));
        return team;
      },

      deleteTeam(teamId) {
        set((state) => ({ teams: state.teams.filter((team) => team.id !== teamId) }));
      },

      addEmployee(teamId, name) {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === teamId
              ? { ...team, employees: [...team.employees, { id: id(), name: trimmed }] }
              : team,
          ),
        }));
      },

      removeEmployee(teamId, employeeId) {
        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === teamId
              ? { ...team, employees: team.employees.filter((entry) => entry.id !== employeeId) }
              : team,
          ),
        }));
      },

      addSalaryPayment(payment) {
        if (!(payment.amount > 0)) return;
        const record: SalaryPayment = { ...payment, id: id(), date: now() };
        set((state) => ({ salaryPayments: [record, ...state.salaryPayments] }));
      },

      removeSalaryPayment(paymentId) {
        set((state) => ({
          salaryPayments: state.salaryPayments.filter((payment) => payment.id !== paymentId),
        }));
      },

      setHasHydrated(value) {
        set({ hasHydrated: value });
      },
    }),
    {
      name: 'suma-proyectos',
      version: 1,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
