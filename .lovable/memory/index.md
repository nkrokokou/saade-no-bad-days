# Project Memory

## Core
SAADÉ - Lebanese pastry lab & boutique in Lomé, Togo. French UI.
Design: cream #FAF6F0, caramel #C49A5A, espresso #2C1A0E. Playfair Display + DM Sans.
Lovable Cloud backend. ~80 real products from Excel in `produits` table.
Roles in `user_roles` table (separate from profiles). Multi-role supported. Enum `app_role`.
Granular permissions via `module_permissions` matrix (role × module × CRUD action).
Use `usePermissions()` hook + `<Can module action>` component for UI gating.
RLS uses `can_perform(uid, module, action)` security definer fn. CEO bypasses all checks.
All sections have Excel import/export + PDF export. Admin panel (CEO) for users/roles/permissions/backup.
AI insights bot (CEO) using Lovable AI gateway.

## Memories
- [Roles & access](mem://features/roles) — Default permission matrix per role/module
- [Database tables](mem://features/tables) — Table names and their purposes
