# Source of Truth - MAPELEC MVP

## North Star

Sistema de gestión de mantenimiento preventivo para cuadrillas de bombas e incendio. Buildings (PH) are the root entity; all maintenance activities, observations, and emergencies belong to a building.

## Roles & Access

- **tech**: Field technician. Access to `/tech/*`. Can view assigned visits, create observations, report emergencies.
- **ops_manager**: Operations manager. Access to `/ops/*`. Can manage crews, buildings, assign visits, view all data.
- **director**: Director. Access to `/dir/*`. Read-only access to all profiles and aggregated data.

## RLS Notes

- All role checks in RLS policies use `public.get_user_role()` (SECURITY DEFINER) to avoid recursion.
- Profiles policies do not query `profiles` directly; they rely on the role function.
- See migration `db/migrations/007_rls_use_get_user_role.sql`.
- Profiles are auto-created on successful login via server action (no middleware side-effects).
- Techs can read visits assigned to them or their crew, and claim crew visits on start (`supabase/migrations/025_visits_crew_assignment_rls.sql`).
- Tech/ops/director can read visit templates and template items (`supabase/migrations/012_templates_rls_read.sql`).
- Service reports are restricted to `ops_manager` and `director` roles only.

## Crews

- **5 crews total**: Pump Crew 1, Pump Crew 2, Pump Crew 3, Pump Crew 4, Fire Crew
- **Interchangeability rule**: Users have a default `home_crew_id`, but crews can be overridden per visit/assignment. Crews are defaults, not hard constraints.

## Core Entities

- **buildings**: Root entity (PH). Contains name, address, lat/lng, systems (pump/fire array), service_flags, notes, created_by, created_at, updated_at.
- **visits**: Scheduled maintenance visits to buildings. Linked to crew, building, date, status, and optional tech attribution (set on start).
- **visit_templates**: Templates for visit checklists (category-based).
- **template_items**: Items within a visit template (checkbox/number/text).
- **visit_responses**: Tech responses to template items per visit; append-only history with latest snapshot via `visit_latest_responses`.
- **service_reports**: Daily report per building/date with editorial status (draft/ready/sent) and client/internal notes.
- **observations**: Issues found during visits. Linked to visit/building, status, quotes, work orders.
- **emergencies**: Emergency calls/dispatches. Linked to building, crew, status, timestamps.
- **media**: Photos/documents attached to visits, observations, or emergencies. Stored in Supabase Storage.
- **plans/templates**: Maintenance plans and visit templates. Define frequency, checklists, requirements.

## Status Enums

### Visit Status
- `planned`: Visit scheduled
- `in_progress`: Visit currently happening
- `completed`: Visit finished successfully
- `missed`: Visit was not completed

### Observation Status
- `open`: Issue identified, no action yet
- `quoted`: Quote provided, awaiting approval
- `approved`: Quote approved, work can begin
- `in_progress`: Work being performed
- `closed`: Issue resolved

### Emergency Status
- `open`: Emergency reported, not yet dispatched
- `dispatched`: Crew assigned and en route
- `resolved`: Emergency handled

## MVP Phases

- **Phase 1**: Auth, roles, crews, buildings table, RLS setup (COMPLETE)
- **Phase 2**: Buildings CRUD for ops_manager, intake with map
- **Phase 3**: Visits scheduling and management
- **Phase 4**: Observations workflow (create, quote, approve, track)
- **Phase 5**: Emergencies dispatch and tracking
- **Phase 6**: Media uploads, plans/templates, reporting

## Data Ingestion

- **Excel import first**: Initial building data comes from Excel import (bulk upload)
- **Intake creates new PH**: After import, new buildings are created via intake form
- **lat/lng mandatory**: All new buildings must have lat/lng coordinates (from map pin or import)

## Equipment / Assets (Roadmap + v0)

- **Decisión**: Building sigue siendo la entidad raíz; equipment es inventario por building.
- **Tabla `public.equipment` (v0)**:
  - `id` uuid primary key default `gen_random_uuid()`
  - `building_id` uuid not null references `public.buildings(id)` on delete cascade
  - `name` text not null
  - `equipment_type` text not null (valores esperados: `pump` | `fire`)
  - `is_active` boolean not null default true
  - `notes` text null
  - `created_at` timestamptz not null default now()
  - `updated_at` timestamptz not null default now()
  - Índices: index on (`building_id`), unique (`building_id`, `name`)
- **`visit_responses.equipment_id` (nullable)**: permite enlazar respuestas a equipo sin romper visitas legacy.
- **Regla**: evidencias técnicas deben poder asociarse a equipment para historial real.
- **Regla**: nombres y metadata de equipment se definen por Ops/Director; Tech solo reporta inconsistencias.
- **Fase actual (v0)**: CRUD de equipment en ops + columna nullable en respuestas; visitas siguen a nivel building.
- **Próxima fase**: persistir relación visit↔equipment (join table) y UI para seleccionar equipment por visita y render por equipment.

- **Template**: "Mantenimiento – Bombas" usa `template_items` (text/textarea/number/checkbox), se ordena por `sort_order` y valida `required` en tech.
