-- Rol `facturacion`: contabilidad de SEMCO (30-sep-2026).
--
-- Pedido de William: que la asistente de contabilidad vea los mantenimientos completados y
-- sus informes en PDF sin que él se los reenvíe uno por uno por WhatsApp.
--
-- Es un rol de SOLO LECTURA. Esta migración únicamente agrega el valor al enum: NO crea
-- políticas RLS. A propósito: la vista /fact y la ruta del PDF autorizan por rol en el
-- servidor y leen con el cliente de administración, así que el rol no necesita ni recibe
-- permiso de lectura o escritura sobre ninguna tabla. Cualquier consulta directa a la base
-- con su sesión cae en las políticas existentes, todas escritas como "solo estos roles".
--
-- Aditiva e idempotente. Orden de despliegue: no importa. El código viejo ignora el valor
-- nuevo y el código nuevo sin el valor simplemente no tiene usuarios con ese rol.
--
-- Reversa: no hay `DROP VALUE` en Postgres. Si hiciera falta, basta con no asignar el rol
-- (o pasar a esos usuarios a `tech` con is_active = false). El valor sin uso no estorba.

alter type public.role add value if not exists 'facturacion';
