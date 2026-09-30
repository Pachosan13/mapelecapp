-- Cierra el hueco de escalada de privilegios en public.profiles.
--
-- Problema: la política profiles_self_update deja a cualquier usuario autenticado actualizar su
-- propia fila SIN límite de columnas, así que un técnico (o el rol facturacion) podía hacerse
-- ops_manager con un PATCH directo a la API de Supabase. No había ningún trigger que lo frenara.
--
-- Arreglo: un trigger BEFORE INSERT OR UPDATE que solo deja tocar role, is_active, home_crew_id,
-- primary_category y user_id a ops_manager. full_name sigue libre para el propio usuario.
-- El service role y psql no se ven afectados (auth.uid() es nulo).

create or replace function public.profiles_proteger_columnas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rol_quien_llama text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select p.role::text into rol_quien_llama from public.profiles p where p.user_id = auth.uid();
  if rol_quien_llama = 'ops_manager' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role::text <> 'tech' then
      raise exception 'Solo ops_manager puede crear perfiles con rol distinto de tech'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.home_crew_id is distinct from old.home_crew_id
     or new.primary_category is distinct from old.primary_category then
    raise exception 'Solo ops_manager puede cambiar rol, estado, cuadrilla o categoría de un perfil'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists a_profiles_proteger_columnas on public.profiles;
create trigger a_profiles_proteger_columnas
  before insert or update on public.profiles
  for each row execute function public.profiles_proteger_columnas();
