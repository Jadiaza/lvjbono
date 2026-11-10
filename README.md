# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Rifas y bonos

Las modalidades se mantienen separadas por `raffle_mode`:

- `standard`: rifa en efectivo con boletas de 2 cifras (00–99) o 3 cifras
  (000–999), guardadas en `tickets`.
- `material_2d`: premio en especie con 100 bonos individuales del 00 al 99,
  guardados en `raffle_bonos` y `raffle_bono_numbers`.
- `dual_bono`: bono en especie con hasta 1.000 números únicos de 3 cifras,
  distribuidos en parejas.

Los cambios de esquema se versionan en `supabase/migrations`. Las migraciones
`20261110160000_material_two_digit_bonos_and_admin_controls.sql` y
`20261110161000_harden_raffle_bono_integrity.sql` agregan las reglas de la
modalidad material y endurecen las operaciones administrativas. Antes de crear
un índice único faltante, la migración de endurecimiento detecta duplicados y
se detiene con sus identificadores para resolverlos manualmente; nunca los
elimina ni modifica. La unicidad es por campaña para números y seriales.

Los cambios de identidad de bonos reservados, asignados, vendidos o pagados se
bloquean en PostgreSQL. Las operaciones administrativas comprueban el usuario
autenticado y su rol desde la sesión; no aceptan la identidad de actor como
autoridad independiente. Los bonos con historial se anulan conservando sus
números y eventos. Las reservas vigentes deben cancelarse formalmente primero,
y los bonos vendidos o pagados no se pueden eliminar ni anular desde este flujo.
Aplica las migraciones mediante el flujo habitual de Supabase después de
revisarlas; no se aplican automáticamente desde la aplicación.

Las pruebas SQL de regresión están en `supabase/tests/raffle_bono_integrity.test.sql`
y se ejecutan contra una base local de pruebas migrada con `supabase test db`.
No ejecutes estas pruebas sobre producción.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
