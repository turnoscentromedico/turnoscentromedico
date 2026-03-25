# Prompt para generar el Dashboard de Administración — svc-appointments

Usá este prompt en tu proyecto frontend con Claude en Cursor.

---

## El prompt

Necesito que me armes **desde cero** un dashboard de administración para un sistema de turnos de clínica médica. El backend ya está 100% funcionando en `http://localhost:3001`.

### Tecnologías obligatorias

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS v4 + shadcn/ui** (para componentes)
- **Clerk** para autenticación (ya tengo las keys configuradas)
- **Tanstack Query (React Query)** para data fetching
- **React Hook Form + Zod** para formularios

### Credenciales de Clerk

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZnJlc2gtZ29sZGZpc2gtMjMuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_gcsqsfzxoTJARnHd7PC4iVlC3B92Nl5oU1kiIuYvT6
```

### Cómo funciona la autenticación

1. El usuario se loguea con Clerk (email/password o Google)
2. El frontend obtiene el JWT con `await getToken()` de Clerk
3. Todas las requests al backend llevan `Authorization: Bearer <jwt>`
4. **AUTO-PROVISIONING**: La primera persona que se loguea se convierte automáticamente en ADMIN. No hay que hacer nada manual.
5. Los siguientes usuarios necesitan ser creados por el admin desde el dashboard.

### API del backend — Todos los endpoints

**Base URL**: `http://localhost:3001`

#### Públicos (sin auth)

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/health` | Estado del sistema |
| GET | `/api/auth/setup-status` | `{ hasAdmin, needsSetup, userCount }` |
| GET | `/api/specialties` | Listar especialidades |
| GET | `/api/specialties/:id` | Detalle especialidad |
| GET | `/api/doctors` | Listar doctores (`?specialtyId=X&clinicId=X`) |
| GET | `/api/doctors/:id` | Detalle doctor |
| GET | `/api/appointments/available?clinicId=X&doctorId=X&date=YYYY-MM-DD` | Slots libres por doctor |
| GET | `/api/appointments/available-by-specialty?clinicId=X&specialtyId=X&date=YYYY-MM-DD` | Slots por especialidad |

#### Autenticados (Bearer token)

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/me` | `{ userId, systemUserId, role, clinicId }` |

#### Operator + Admin

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/patients` | Crear paciente `{ firstName, lastName, email, phone?, dateOfBirth? }` |
| GET | `/api/patients` | Listar pacientes |
| GET | `/api/patients/:id` | Detalle paciente |
| PUT | `/api/patients/:id` | Actualizar paciente |
| DELETE | `/api/patients/:id` | Eliminar paciente |
| POST | `/api/appointments` | Reservar turno `{ clinicId, doctorId, patientId, date: "YYYY-MM-DD", startTime: "HH:mm", notes? }` |
| GET | `/api/appointments` | Listar turnos (`?clinicId=X&doctorId=X&patientId=X`) |
| GET | `/api/appointments/:id` | Detalle turno |
| PATCH | `/api/appointments/:id/cancel` | Cancelar turno |

#### Solo Admin

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/dashboard/stats` | Stats generales `{ clinics, doctors, patients, specialties, users, appointments: { total, byStatus } }` |
| POST | `/api/clinics` | Crear clínica `{ name, address?, phone? }` |
| GET | `/api/clinics` | Listar clínicas |
| GET | `/api/clinics/:id` | Detalle clínica (incluye `_count` de doctores y appointments) |
| PUT | `/api/clinics/:id` | Actualizar clínica |
| DELETE | `/api/clinics/:id` | Eliminar clínica |
| POST | `/api/specialties` | Crear especialidad `{ name, description? }` |
| PUT | `/api/specialties/:id` | Actualizar especialidad |
| DELETE | `/api/specialties/:id` | Eliminar especialidad |
| POST | `/api/doctors` | Crear doctor `{ name, specialtyId, clinicId }` |
| PUT | `/api/doctors/:id` | Actualizar doctor |
| DELETE | `/api/doctors/:id` | Eliminar doctor |
| POST | `/api/schedules` | Crear horario `{ doctorId, dayOfWeek (0-6), startTime: "HH:mm", endTime: "HH:mm", slotDuration?: 30, active?: true }` |
| GET | `/api/schedules/doctor/:doctorId` | Horarios de un doctor |
| PUT | `/api/schedules/:id` | Actualizar horario |
| DELETE | `/api/schedules/:id` | Eliminar horario |
| POST | `/api/users` | Crear operador/admin `{ clerkUserId, name, email, role: "ADMIN"|"OPERATOR", clinicId? }` |
| GET | `/api/users` | Listar usuarios del sistema |
| GET | `/api/users/:id` | Detalle usuario |
| PUT | `/api/users/:id` | Actualizar usuario |
| DELETE | `/api/users/:id` | Desactivar usuario (soft delete) |

### Formato de respuestas

Todas las respuestas exitosas: `{ success: true, data: ... }`
Errores: `{ success: false, error: "CODE", message: "...", statusCode: N }`
Códigos de error posibles: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `OUTSIDE_SCHEDULE` (400), `DOCTOR_CLINIC_MISMATCH` (400), `ALREADY_CANCELLED` (400), `INVALID_SLOT_TIME` (400)

### Estructura de páginas del dashboard

```
/                       → Redirect a /dashboard
/sign-in                → Clerk SignIn (si no está logueado)
/dashboard              → Overview con stats (cards: clínicas, doctores, pacientes, turnos)
/dashboard/clinics      → CRUD de clínicas (tabla + modal de crear/editar)
/dashboard/specialties  → CRUD de especialidades
/dashboard/doctors      → CRUD de doctores (con selector de clínica y especialidad)
/dashboard/doctors/:id  → Detalle del doctor + gestión de horarios semanales
/dashboard/patients     → CRUD de pacientes (búsqueda por nombre/email)
/dashboard/appointments → Vista de turnos (calendario o tabla, filtros por clínica/doctor/fecha)
/dashboard/appointments/new → Wizard para reservar turno (elegir clínica → doctor → fecha → slot → paciente)
/dashboard/users        → Gestión de operadores (solo visible para ADMIN)
```

### Detalles de UX importantes

1. **Primera vez**: Cuando `GET /api/auth/setup-status` devuelve `needsSetup: true`, mostrar un banner de bienvenida tipo "Logueate para configurar el sistema como administrador".

2. **Sidebar**: Navegación lateral con ícono y nombre de cada sección. Mostrar "Usuarios" solo si el rol es ADMIN.

3. **Página de Doctor > Horarios**: Mostrar una grilla semanal (Lun-Dom) donde para cada día se pueda:
   - Agregar un bloque horario (startTime, endTime, duración de slot)
   - Activar/desactivar un día
   - Los `dayOfWeek` van de 0 (Domingo) a 6 (Sábado)

4. **Wizard de turno nuevo**:
   - Paso 1: Elegir clínica
   - Paso 2: Elegir especialidad o doctor directamente
   - Paso 3: Elegir fecha (date picker, solo futuro)
   - Paso 4: Ver slots disponibles (llamar a `/api/appointments/available`) y elegir uno
   - Paso 5: Buscar/seleccionar paciente (o crear uno nuevo inline)
   - Paso 6: Confirmar y reservar

5. **Turnos del día**: En el overview, mostrar los próximos turnos de hoy.

6. **Toast notifications**: Usar toasts para confirmar acciones (creado, actualizado, eliminado, error).

### Consideraciones técnicas

- Crear un `lib/api.ts` centralizado que use `fetch` + `getToken()` de Clerk para todas las requests.
- Usar Tanstack Query con keys bien estructuradas para cache e invalidación.
- Los formularios deben tener validación con Zod (mismas reglas que el backend).
- Responsive: funcionar bien en desktop (1280px+), tablet sería un bonus.
- Tema oscuro/claro con Tailwind.

### Variables de entorno del frontend

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZnJlc2gtZ29sZGZpc2gtMjMuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_gcsqsfzxoTJARnHd7PC4iVlC3B92Nl5oU1kiIuYvT6
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Armá todo el proyecto completo con buena estructura de carpetas. Que sea moderno, limpio y profesional.
