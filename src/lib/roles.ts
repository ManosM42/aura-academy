// src/lib/roles.ts
// Ιεραρχία ρόλων AURA — τα κλειδιά ταιριάζουν 1:1 με το UserRole enum
// του public.profiles.role. Μεγαλύτερος βαθμός = περισσότερα δικαιώματα.
export const ROLE_RANK = {
  student: 10,
  educator: 20,
  senior_educator: 30,
  content_manager: 30,
  operations: 35,
  admin: 40,
  super_admin: 50,
} as const;

export type KnownRole = keyof typeof ROLE_RANK;

/** Ελάχιστος βαθμός για τα εργαλεία του team (Review Queue). */
export const STAFF_RANK = ROLE_RANK.educator;
/** Ελάχιστος βαθμός για Admin Panel & Inbox. */
export const ADMIN_RANK = ROLE_RANK.admin;

/** Άγνωστος, κενός ή null ρόλος → 0. Fail closed. */
export function roleRank(role: string | null | undefined): number {
  if (!role) return 0;
  const key = role.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return key in ROLE_RANK ? ROLE_RANK[key as KnownRole] : 0;
}

/** Educator και πάνω. */
export function isStaffRole(role: string | null | undefined): boolean {
  return roleRank(role) >= STAFF_RANK;
}

/** Admin και πάνω — Admin Panel και Inbox. */
export function isAdminRole(role: string | null | undefined): boolean {
  return roleRank(role) >= ADMIN_RANK;
}

/** Ρητό κατώφλι, όταν θέλεις κάτι ενδιάμεσο. */
export function hasAtLeastRole(role: string | null | undefined, minimum: KnownRole): boolean {
  return roleRank(role) >= ROLE_RANK[minimum];
}