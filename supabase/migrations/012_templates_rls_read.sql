-- Allow tech/ops/director to read templates and items
drop policy if exists "Authenticated users can read visit templates" on public.visit_templates;
drop policy if exists "Authenticated users can read template items" on public.template_items;
drop policy if exists "Roles can read visit templates" on public.visit_templates;
drop policy if exists "Roles can read template items" on public.template_items;

create policy "Roles can read visit templates"
on public.visit_templates for select
using (public.get_user_role() in ('ops_manager', 'director', 'tech'));

create policy "Roles can read template items"
on public.template_items for select
using (public.get_user_role() in ('ops_manager', 'director', 'tech'));
