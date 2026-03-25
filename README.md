# svc-appointments

Backend completo para sistema de turnos de clínica médica con soporte multi-centro.

## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Fastify v5
- **ORM:** Prisma + PostgreSQL (Neon)
- **Validación:** Zod + fastify-type-provider-zod
- **Auth:** Clerk
- **Colas:** BullMQ + Redis
- **Email:** Resend
- **WhatsApp:** Cloud API (Meta)

## Estructura del proyecto

```
src/
├── middlewares/
│   └── auth.middleware.ts        # Clerk JWT verification
├── modules/
│   ├── appointment/              # Turnos (CRUD + available slots)
│   ├── clinic/                   # Clínicas (CRUD)
│   ├── doctor/                   # Médicos (CRUD + filtros)
│   ├── patient/                  # Pacientes (CRUD)
│   └── specialty/                # Especialidades (CRUD)
├── plugins/
│   ├── prisma.ts                 # Prisma client plugin
│   └── bull-board.ts             # Dashboard de colas
├── queue/
│   ├── index.ts                  # Conexión Redis
│   ├── appointment.queue.ts      # Cola + funciones de enqueue
│   └── appointment.worker.ts     # Worker de notificaciones
├── services/
│   └── notification.service.ts   # Email (Resend) + WhatsApp
├── utils/
│   ├── config.ts                 # Env validation con Zod
│   ├── errors.ts                 # Error handler centralizado
│   └── logger.ts                 # Pino logger
├── app.ts                        # Builder de la app Fastify
└── server.ts                     # Entrypoint
```

## Setup local

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd svc-appointments
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Editá `.env` con tus credenciales. Las **obligatorias** para desarrollo son:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `REDIS_URL` | Redis connection string |

Las **opcionales** (el sistema funciona sin ellas en dev):

| Variable | Descripción |
|---|---|
| `CLERK_SECRET_KEY` | Clerk secret key (sin esto, auth funciona en modo dev) |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `RESEND_API_KEY` | Resend API key para emails |
| `RESEND_FROM_EMAIL` | Email del remitente |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID |

### 3. Base de datos

```bash
npx prisma generate
npx prisma db push
```

### 4. Levantar en desarrollo

```bash
npm run dev
```

El servidor arranca en `http://localhost:3000`. El worker de notificaciones arranca automáticamente.

## Endpoints

### Públicos (sin auth)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Health check con estado de servicios |
| `GET` | `/api/specialties` | Listar especialidades |
| `GET` | `/api/specialties/:id` | Detalle de especialidad |
| `GET` | `/api/doctors` | Listar médicos (filtros: `?specialtyId=&clinicId=`) |
| `GET` | `/api/doctors/:id` | Detalle de médico |
| `GET` | `/api/appointments/available` | Slots libres (`?clinicId=&doctorId=&date=`) |
| `GET` | `/api/appointments/available-by-specialty` | Slots por especialidad (`?clinicId=&specialtyId=&date=`) |

### Protegidos (requieren `Authorization: Bearer <token>`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/me` | Usuario autenticado actual |
| `POST` | `/api/clinics` | Crear clínica |
| `GET` | `/api/clinics` | Listar clínicas |
| `PUT` | `/api/clinics/:id` | Actualizar clínica |
| `DELETE` | `/api/clinics/:id` | Eliminar clínica |
| `POST` | `/api/doctors` | Crear médico |
| `PUT` | `/api/doctors/:id` | Actualizar médico |
| `DELETE` | `/api/doctors/:id` | Eliminar médico |
| `POST` | `/api/patients` | Crear paciente |
| `GET` | `/api/patients` | Listar pacientes |
| `PUT` | `/api/patients/:id` | Actualizar paciente |
| `DELETE` | `/api/patients/:id` | Eliminar paciente |
| `POST` | `/api/appointments` | Reservar turno |
| `GET` | `/api/appointments` | Listar turnos (filtros: `?clinicId=&doctorId=&patientId=`) |
| `GET` | `/api/appointments/:id` | Detalle de turno |
| `PATCH` | `/api/appointments/:id/cancel` | Cancelar turno |

### Admin

| Ruta | Descripción |
|---|---|
| `/admin/queues` | Dashboard de Bull Board (requiere auth) |

## Flujo completo de turno + recordatorios

### 1. Crear datos base

```bash
# Crear especialidad
curl -X POST http://localhost:3000/api/specialties \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{"name": "Cardiología"}'

# Crear clínica
curl -X POST http://localhost:3000/api/clinics \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{"name": "Clínica Central", "address": "Av. Corrientes 1234"}'

# Crear médico (usar IDs reales de specialty y clinic)
curl -X POST http://localhost:3000/api/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{"name": "Dr. García", "specialtyId": 1, "clinicId": 1}'

# Crear paciente
curl -X POST http://localhost:3000/api/patients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{"firstName": "Juan", "lastName": "Pérez", "email": "juan@example.com", "phone": "5491155551234"}'
```

### 2. Configurar horario del médico

Crear un `DoctorSchedule` directamente en la DB o con Prisma Studio:

```bash
npx prisma studio
```

Agregar un schedule: `doctorId=1, dayOfWeek=1 (lunes), startTime="09:00", endTime="17:00", slotDuration=30`.

### 3. Consultar slots disponibles

```bash
curl "http://localhost:3000/api/appointments/available?clinicId=1&doctorId=1&date=2026-03-30"
```

### 4. Reservar turno

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{"clinicId": 1, "doctorId": 1, "patientId": 1, "date": "2026-03-30", "startTime": "09:00"}'
```

Al reservar, se encolan automáticamente 3 jobs:
- **send-confirmation** → inmediato
- **send-reminder-24h** → 24 horas antes del turno
- **send-reminder-2h** → 2 horas antes del turno

### 5. Ver estado de las colas

Abrir `http://localhost:3000/admin/queues` (requiere auth header).

## Deploy a Railway

### 1. Crear proyecto en Railway

```bash
railway init
```

### 2. Agregar servicios

- **PostgreSQL** → Railway provisiona automáticamente, copiar `DATABASE_URL`
- **Redis** → Agregar plugin Redis, copiar `REDIS_URL`

### 3. Variables de entorno

Configurar en el dashboard de Railway:

```
DATABASE_URL=<auto desde Railway>
REDIS_URL=<auto desde Railway>
NODE_ENV=production
CLERK_SECRET_KEY=sk_live_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=turnos@tudominio.com
```

### 4. Build & Deploy

Railway detecta el `package.json` y ejecuta:

```bash
npm run build    # tsc
npm run start    # node dist/server.js
```

Asegurate de que `prisma generate` corra en el build. Agregá un script:

```json
{
  "scripts": {
    "build": "prisma generate && tsc"
  }
}
```

### 5. Migración de DB

```bash
railway run npx prisma db push
```

## Tests

### Stack de testing

- **Vitest** — Test runner moderno y rápido
- **Fastify inject** — Testing HTTP sin levantar servidor
- **Prisma real** — Tests contra la base de datos (con cleanup automático)
- **Mocks** — Redis/BullMQ, Bull Board, Clerk, Resend, WhatsApp

### Setup

1. Crear una base de datos de test:

```sql
CREATE DATABASE svc_appointments_test;
```

2. Configurar `.env.test`:

```bash
cp .env.test .env.test.local
# Editá DATABASE_URL apuntando a tu DB de test
```

3. Sincronizar schema:

```bash
dotenv -e .env.test -- npx prisma db push
```

### Correr tests

```bash
npm test              # Correr todos los tests
npm run test:watch    # Watch mode
npm run test:ui       # Vitest UI (dashboard visual)
```

### Estructura de tests

```
tests/
├── setup.ts              # Cleanup global de Prisma
├── helpers.ts            # PrismaClient, seeders, inject helpers
├── health.test.ts        # Health check y estado de servicios
├── auth.test.ts          # Auth middleware (401, dev-mode, /me)
├── specialty.test.ts     # CRUD completo de especialidades
├── clinic.test.ts        # CRUD completo de clínicas (protected)
├── doctor.test.ts        # Public GET + protected write
├── patient.test.ts       # CRUD completo de pacientes (protected)
├── appointment.test.ts   # Flujo completo de turnos (el crítico)
└── queue.test.ts         # Lógica de colas y NotificationService
```

### Cobertura de `appointment.test.ts`

| Escenario | Test |
|---|---|
| Obtener available slots por doctor | ✅ |
| Obtener slots por especialidad | ✅ |
| Día sin schedule → vacío | ✅ |
| Slots públicos (sin auth) | ✅ |
| Reservar turno exitosamente | ✅ |
| Enqueue de 3 jobs (confirmation + 24h + 2h) | ✅ |
| Double-booking → 409 CONFLICT | ✅ |
| Fuera de horario → 400 | ✅ |
| Slot no alineado → 400 | ✅ |
| Doctor en otra clínica → 400 | ✅ |
| Booking sin auth → 401 | ✅ |
| Slot reservado desaparece de available | ✅ |
| Cancelar turno → CANCELLED | ✅ |
| Remove de reminder jobs al cancelar | ✅ |
| Cancelar ya cancelado → 400 | ✅ |
| Appointment no existe → 404 | ✅ |
| Listar con filtros | ✅ |
| Detalle de appointment | ✅ |

### Cobertura esperada

> **~95%+** en lógica de negocio (services + routes).
> Los únicos gaps son integraciones reales (Resend, WhatsApp, Clerk en prod) que se testean con mocks.

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Desarrollo con hot reload (tsx watch) |
| `npm run build` | Compilar TypeScript |
| `npm start` | Producción |
| `npm test` | Correr todos los tests |
| `npm run test:watch` | Tests en watch mode |
| `npm run test:ui` | Vitest UI |
| `npm run db:generate` | Generar Prisma Client |
| `npm run db:push` | Sincronizar schema con DB |
| `npm run db:migrate` | Crear migración |
| `npm run db:studio` | Abrir Prisma Studio |
