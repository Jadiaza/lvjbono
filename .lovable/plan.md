# Plan: ¡Qué Locura de Rifa!

Sistema web (instalable como PWA) con Lovable Cloud como base de datos, confirmación de pago por comprobante manual vía WhatsApp, tablero virtual 00–99, panel administrador y cálculo automático del sorteo.

## Stack y estructura

- TanStack Start + Lovable Cloud (Supabase gestionado por Lovable).
- Auth email/password para admin.
- Tailwind + shadcn, tema oscuro morado/dorado inspirado en las boletas subidas.
- PWA (manifest + íconos) para "instalar en el celular".

## Modelo de datos (migración)

Tablas en `public`:

- `raffles` — id, nombre, valor_boleta, fecha_sorteo, loteria, activa, whatsapp_admin, nequi, daviplata, bre_b, created_at.
- `tickets` — id, raffle_id, numero (0–99), estado (`disponible|reservado|vendido|ganador`), nombre, telefono, ciudad, email, fecha_compra, valor_pagado, observaciones, codigo_verificacion (uuid), medio_pago. Unique(raffle_id, numero).
- `draws` — id, raffle_id, premio_mayor, seco_1, seco_2, aprox_anterior, aprox_posterior, ganadores jsonb, fecha.
- `user_roles` (patrón admin seguro) + función `has_role`.

RLS:

- `tickets` SELECT anon → solo columnas seguras vía vista `public_tickets` (numero, estado). Escritura solo admin/service_role.
- `raffles` SELECT anon = activa=true.
- Reserva pública: server function que valida número disponible e inserta como `reservado`.

## Flujo comprador (pública `/`)

1. Landing con hero de la boleta, precio, premios, fecha.
2. Tablero 10×10 con estados por color (disponible / reservado / vendido).
3. Al pulsar un número disponible → modal con formulario (nombre, teléfono, ciudad, email opcional, elegir Nequi/Daviplata/Bre-B).
4. Server fn `reservarNumero` marca como `reservado` con `codigo_verificacion` (UUID) y devuelve datos de pago + botón "Enviar comprobante por WhatsApp" con mensaje pre-armado (número, nombre, código).
5. Página `/boleta/:codigo` muestra la boleta virtual con QR (código de verificación), imprimible/descargable.

## Panel Admin (`/_authenticated/admin/*`)

- `/admin` — dashboard: vendidos, reservados, disponibles, recaudo.
- `/admin/ventas` — tabla con todos los tickets, filtros por estado, acciones: confirmar pago (reservado→vendido), anular, editar. Exportar CSV.
- `/admin/rifa` — editar datos de la rifa (loteria, fecha, medios de pago, WhatsApp, activar/desactivar ventas).
- `/admin/sorteo` — ingresar Premio Mayor, Seco 1, Seco 2 → calcula automáticamente los 5 ganadores aplicando regla de no acumulación y aproximaciones con wrap (00→99 / 99→00). Muestra acta imprimible y marca tickets ganadores.

## Lógica del sorteo (server fn)

```text
mayor = ultimas2(premio_mayor)
seco1 = ultimas2(seco_1)
seco2 = ultimas2(seco_2)
aprev = (mayor - 1 + 100) % 100
apost = (mayor + 1) % 100

Asignación en orden de valor (mayor→menor):
  Mayor $300k → mayor
  Seco1 $100k → seco1 (si != mayor, si no se pierde)
  Seco2 $80k  → seco2 (si != mayor y != seco1)
  AprevAnt $10k → aprev (si != asignados previos)
  AproxPost $10k → apost (si != asignados previos)
```

Genera acta con nombre del ganador (o "Sin vender") y actualiza estado.

## PWA

- `public/manifest.webmanifest` + íconos (generar 192/512).
- Links en `__root.tsx` head; sin service worker offline (no lo pidió).

## SEO / head

Cada ruta pública con `head()` único: título, descripción, og:title/og:description, og:image (hero generado).

## Archivos a crear/modificar

- Migración Cloud: schema + roles + policies + trigger seed rifa inicial.
- `src/routes/index.tsx` (landing + tablero).
- `src/routes/boleta.$codigo.tsx`.
- `src/routes/auth.tsx` (login admin).
- `src/routes/_authenticated/admin/route.tsx`, `index.tsx`, `ventas.tsx`, `rifa.tsx`, `sorteo.tsx`.
- `src/lib/raffle.functions.ts` (reservar, confirmar, anular, sorteo).
- `src/components/raffle/*` (BoardGrid, TicketCard, ReservationDialog, PrizesTable).
- `src/styles.css` — tokens oro/morado.
- Hero image generada + íconos PWA.
- `public/manifest.webmanifest`, `robots.txt`, `sitemap.xml`.

## Fuera de alcance (confirmar si los quieres luego)

- Envío automático de PDF por email/WhatsApp API (requiere Resend + WhatsApp Business API con costo). En su lugar entrego página de boleta imprimible + QR + botón "compartir por WhatsApp".
- Pasarela automática (Wompi/Mercado Pago) — elegiste comprobante manual.
- Sincronización a Google Sheets — elegiste solo Cloud.

¿Apruebas para construir?
