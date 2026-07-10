-- ============================================
-- MAPELEC - Alineación de políticas DELETE
--
-- Regla: borran ops_manager y director. Los techs no, con una sola
-- excepción ya existente: su propia foto de su propia visita.
--
-- `equipment` tenía RLS activo sin ninguna política DELETE, así que el
-- borrado se negaba en silencio (0 filas, sin error) y la app redirigía
-- como si hubiera funcionado.
--
-- buildings / template_items ya permiten DELETE a ops_manager vía sus
-- políticas `for all`. Acá solo se suma al director, con políticas
-- DELETE aparte para no concederle también insert/update.
-- ============================================

-- --------------------------------------------
-- equipment: no existía política DELETE
-- --------------------------------------------
drop policy if exists "Ops managers and directors can delete equipment" on public.equipment;

create policy "Ops managers and directors can delete equipment"
on public.equipment for delete
using (public.get_user_role() in ('ops_manager', 'director'));

-- --------------------------------------------
-- buildings: ops_manager ya cubierto por "Ops managers can manage buildings"
-- --------------------------------------------
drop policy if exists "Directors can delete buildings" on public.buildings;

create policy "Directors can delete buildings"
on public.buildings for delete
using (public.get_user_role() = 'director');

-- --------------------------------------------
-- template_items: ops_manager ya cubierto por "Ops managers can manage template items"
-- --------------------------------------------
drop policy if exists "Directors can delete template items" on public.template_items;

create policy "Directors can delete template items"
on public.template_items for delete
using (public.get_user_role() = 'director');

-- --------------------------------------------
-- media: ops_manager y tech (propia) ya cubiertos en 20260225170000
-- --------------------------------------------
drop policy if exists "Directors can delete media" on public.media;

create policy "Directors can delete media"
on public.media for delete
using (public.get_user_role() = 'director');

-- El objeto en storage debe poder borrarse por quien borra la fila,
-- si no el archivo queda huérfano en el bucket.
drop policy if exists "Directors can delete media objects" on storage.objects;

create policy "Directors can delete media objects"
on storage.objects for delete
using (
  bucket_id = 'media'
  and public.get_user_role() = 'director'
);
