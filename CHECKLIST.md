# Checklist de Verificación - Fase 1

## ✅ Checklist de Verificación Técnica

### Setup del Proyecto
- [ ] Proyecto Next.js creado con App Router
- [ ] TypeScript configurado correctamente
- [ ] Tailwind CSS configurado y funcionando
- [ ] Estructura de carpetas creada: `/app`, `/components`, `/lib`, `/db`, `/types`
- [ ] Variables de entorno configuradas (`.env.local`)

### Supabase
- [ ] Proyecto Supabase creado
- [ ] Variables de entorno configuradas:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Cliente de Supabase para browser (`/lib/supabase/client.ts`)
- [ ] Cliente de Supabase para server (`/lib/supabase/server.ts`)
- [ ] Helper `getCurrentUser()` implementado

### Base de Datos
- [ ] Migración SQL ejecutada (`001_initial_schema.sql`)
- [ ] Enums creados:
  - [ ] `role` (tech, ops_manager, director)
  - [ ] `category` (pump, fire)
  - [ ] `frequency` (monthly, bimonthly)
  - [ ] `visit_status` (planned, in_progress, completed, missed)
  - [ ] `obs_status` (open, quoted, approved, in_progress, closed)
  - [ ] `emergency_status` (open, dispatched, resolved)
- [ ] Tablas creadas:
  - [ ] `crews` (id, name, category, created_at)
  - [ ] `profiles` (user_id, full_name, role, primary_category, home_crew_id, is_active, created_at, updated_at)
  - [ ] `buildings` (id, name, address, lat, lng, service_flags, notes, created_by, created_at)
- [ ] RLS habilitado en todas las tablas
- [ ] Políticas RLS configuradas correctamente
- [ ] Trigger `handle_new_user()` creado y funcionando
- [ ] Trigger `update_updated_at_column()` creado
- [ ] Seed de 5 crews ejecutado (Pump Crew 1-4, Fire Crew)

### Autenticación
- [ ] Página `/login` creada y funcional
- [ ] Middleware de protección implementado
- [ ] Redirección por rol funcionando:
  - [ ] `tech` → `/tech/today`
  - [ ] `ops_manager` → `/ops/dashboard`
  - [ ] `director` → `/dir/overview`
- [ ] Páginas placeholder creadas:
  - [ ] `/tech/today`
  - [ ] `/ops/dashboard`
  - [ ] `/dir/overview`

### Funcionalidad
- [ ] Al crear usuario en Supabase Auth, se crea automáticamente profile con role 'tech'
- [ ] Login funciona correctamente
- [ ] Middleware protege rutas según rol
- [ ] Usuario puede ver su propio perfil
- [ ] Ops_manager puede leer todos los perfiles
- [ ] Ops_manager puede escribir en crews y buildings
- [ ] Usuarios autenticados pueden leer crews y buildings

## 🧪 Pruebas Manuales

### Test 1: Crear Usuario y Verificar Profile
1. [ ] Crear usuario en Supabase Dashboard > Authentication
2. [ ] Verificar que se creó automáticamente un row en `profiles` con role 'tech'
3. [ ] Verificar que `is_active = true` por defecto

### Test 2: Login y Redirección
1. [ ] Ir a `/login`
2. [ ] Loguearse con usuario tech
3. [ ] Verificar redirección a `/tech/today`
4. [ ] Cerrar sesión
5. [ ] Cambiar role a `ops_manager` en Supabase (SQL)
6. [ ] Loguearse nuevamente
7. [ ] Verificar redirección a `/ops/dashboard`
8. [ ] Repetir con `director` → `/dir/overview`

### Test 3: Protección de Rutas
1. [ ] Loguearse como tech
2. [ ] Intentar acceder a `/ops/dashboard` (debe redirigir a `/tech/today`)
3. [ ] Intentar acceder a `/dir/overview` (debe redirigir a `/tech/today`)
4. [ ] Repetir con otros roles

### Test 4: RLS - Profiles
1. [ ] Loguearse como tech
2. [ ] Verificar que puede leer su propio perfil
3. [ ] Loguearse como ops_manager
4. [ ] Verificar que puede leer todos los perfiles

### Test 5: RLS - Crews y Buildings
1. [ ] Loguearse como tech
2. [ ] Verificar que puede leer crews (SELECT)
3. [ ] Verificar que NO puede insertar/actualizar crews (debe fallar)
4. [ ] Loguearse como ops_manager
5. [ ] Verificar que puede leer y escribir crews
6. [ ] Repetir con buildings

## 📋 Criterios de Éxito

- ✅ Proyecto se ejecuta localmente sin errores
- ✅ Puedo loguearme correctamente
- ✅ Se crea profile automáticamente al crear usuario
- ✅ Middleware redirige por rol correctamente
- ✅ Tablas `buildings`, `crews`, `profiles` existen con RLS activo
- ✅ Hay 5 crews seeded en la base de datos
- ✅ RLS funciona correctamente según las políticas definidas

## 🚨 Problemas Comunes

### El proyecto no inicia
- Verificar que `npm install` se ejecutó correctamente
- Verificar que las variables de entorno están en `.env.local` (no `.env`)
- Verificar que las variables tienen los valores correctos

### Error al loguearse
- Verificar que el usuario existe en Supabase Auth
- Verificar que el usuario tiene un profile (debe crearse automáticamente)
- Verificar que las variables de entorno están correctas

### RLS bloquea operaciones
- Verificar que las políticas RLS están activas
- Verificar que el usuario tiene el role correcto en `profiles`
- Verificar que estás usando el cliente correcto (browser vs server)

### No se crea profile automáticamente
- Verificar que el trigger `on_auth_user_created` existe
- Verificar que la función `handle_new_user()` existe
- Verificar que el trigger está vinculado a `auth.users`

---

**Una vez completado este checklist, la Fase 1 está lista. Proceder con Fase 2 según los prompts sugeridos en el README.**
