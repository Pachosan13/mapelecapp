# Source of Truth - MAPELEC MVP

## North Star

Sistema de gestión de mantenimiento preventivo para cuadrillas de bombas e incendio. Buildings (PH) are the root entity; all maintenance activities, observations, and emergencies belong to a building.

## Roles & Access

- **tech**: Field technician. Access to `/tech/*`. Can view assigned visits, create observations, report emergencies.
- **ops_manager**: Operations manager. Access to `/ops/*`. Can manage crews, buildings, assign visits, view all data.
- **director**: Director. Access to `/dir/*`. Read-only access to all profiles and aggregated data.

## RLS Notes

- Profiles role checks use `public.get_user_role()` (SECURITY DEFINER) to avoid RLS recursion.
- See migration `db/migrations/006_profiles_rls_fix.sql`.
- Profiles policies include self read/write/insert and ops_manager read/manage without recursion.

## Crews

- **5 crews total**: Pump Crew 1, Pump Crew 2, Pump Crew 3, Pump Crew 4, Fire Crew
- **Interchangeability rule**: Users have a default `home_crew_id`, but crews can be overridden per visit/assignment. Crews are defaults, not hard constraints.

## Core Entities

- **buildings**: Root entity (PH). Contains name, address, lat/lng, service_flags, notes, created_by, created_at, updated_at.
- **visits**: Scheduled maintenance visits to buildings. Linked to crew, building, date, status.
- **visit_templates**: Templates for visit checklists (category-based).
- **template_items**: Items within a visit template (checkbox/number/text).
- **visit_responses**: Tech responses to template items per visit.
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
