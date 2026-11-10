BEGIN;

SELECT plan(27);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'bono-admin-tests@example.invalid', '', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'bono-user-tests@example.invalid', '', now(), now(), now());

INSERT INTO public.user_roles (user_id, role)
VALUES ('00000000-0000-4000-8000-000000000001', 'admin');

INSERT INTO public.raffles (
  id, nombre, valor_boleta, activa, raffle_mode, digitos,
  bono_total, bono_numbers_per_ticket
)
VALUES
  ('00000000-0000-4000-8000-000000000011', 'Integrity material one', 1000, false,
    'material_2d', 2, 100, 1),
  ('00000000-0000-4000-8000-000000000012', 'Integrity material two', 1000, false,
    'material_2d', 2, 100, 1),
  ('00000000-0000-4000-8000-000000000013', 'Integrity dual', 1000, false,
    'dual_bono', 3, 1, 2),
  ('00000000-0000-4000-8000-000000000014', 'Integrity standard', 1000, false,
    'standard', 2, NULL, NULL);

SELECT set_config(
  'request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

SELECT is(
  public.generate_dual_bonos('00000000-0000-4000-8000-000000000011', 100),
  100,
  'material campaigns generate 100 bonos'
);
SELECT is(
  public.generate_dual_bonos('00000000-0000-4000-8000-000000000012', 100),
  100,
  'a second material campaign generates independently'
);
SELECT is(
  public.generate_dual_bonos('00000000-0000-4000-8000-000000000013', 1),
  1,
  'three-digit dual campaign generation remains available'
);

UPDATE public.raffle_bonos
SET status = 'reservado', reserved_at = now(), reservation_expires_at = now() + interval '1 hour'
WHERE raffle_id = '00000000-0000-4000-8000-000000000013' AND serial = 1;
UPDATE public.raffle_bonos
SET status = 'pagado', amount_paid = 1
WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 3;
INSERT INTO public.raffle_bono_events (raffle_id, bono_id, event_type, metadata)
SELECT raffle_id, id, 'prueba_historial', '{"test":true}'::jsonb
FROM public.raffle_bonos
WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 4;

CREATE TEMP TABLE test_physical_delete (bono_id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO test_physical_delete
SELECT id FROM public.raffle_bonos
WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 100;

SELECT ok(
  (SELECT count(*) = 100
      AND count(DISTINCT numero) = 100
      AND min(numero) = 0
      AND max(numero) = 99
    FROM public.raffle_bono_numbers
    WHERE raffle_id = '00000000-0000-4000-8000-000000000011')
  AND
  (SELECT count(*) = 100
      AND count(DISTINCT serial) = 100
      AND min(serial) = 1
      AND max(serial) = 100
    FROM public.raffle_bonos
    WHERE raffle_id = '00000000-0000-4000-8000-000000000011')
  AND NOT EXISTS (
    SELECT 1
    FROM public.raffle_bonos rb
    LEFT JOIN public.raffle_bono_numbers rn ON rn.bono_id = rb.id
    WHERE rb.raffle_id = '00000000-0000-4000-8000-000000000011'
    GROUP BY rb.id
    HAVING count(rn.id) <> 1
  ),
  'material campaign has all numbers 0 through 99, unique serials 1 through 100, and one number per bono'
);

SELECT is(
  (SELECT count(*)::integer
    FROM public.raffle_bono_numbers first_campaign
    JOIN public.raffle_bono_numbers second_campaign
      ON second_campaign.numero = first_campaign.numero
    WHERE first_campaign.raffle_id = '00000000-0000-4000-8000-000000000011'
      AND second_campaign.raffle_id = '00000000-0000-4000-8000-000000000012'),
  100,
  'different campaigns may use the same numbers'
);

SELECT throws_ok(
  $$SELECT public.generate_dual_bonos('00000000-0000-4000-8000-000000000011', 100)$$,
  'P0001',
  'bonos_already_generated',
  'a material campaign cannot be generated twice'
);

SELECT throws_ok(
  $$
    INSERT INTO public.raffle_bono_numbers (raffle_id, bono_id, option_number, numero)
    SELECT '00000000-0000-4000-8000-000000000011', target.id, 1, existing.numero
    FROM public.raffle_bonos target
    JOIN public.raffle_bono_numbers existing
      ON existing.raffle_id = target.raffle_id
    WHERE target.raffle_id = '00000000-0000-4000-8000-000000000011'
      AND target.serial = 2
      AND existing.bono_id <> target.id
    LIMIT 1
  $$,
  '23505',
  'duplicate key value violates unique constraint "raffle_bono_numbers_raffle_id_numero_key"',
  'a number cannot be duplicated within one campaign'
);

SELECT throws_ok(
  $$
    INSERT INTO public.raffle_bono_numbers (raffle_id, bono_id, option_number, numero)
    SELECT '00000000-0000-4000-8000-000000000012', id, 0, 100
    FROM public.raffle_bonos
    WHERE raffle_id = '00000000-0000-4000-8000-000000000012' AND serial = 1
  $$,
  'P0001',
  'invalid_bono_number',
  'option_number cannot be below one'
);

SELECT throws_ok(
  $$
    INSERT INTO public.raffle_bono_numbers (raffle_id, bono_id, option_number, numero)
    SELECT '00000000-0000-4000-8000-000000000012', id, 2, 100
    FROM public.raffle_bonos
    WHERE raffle_id = '00000000-0000-4000-8000-000000000012' AND serial = 1
  $$,
  'P0001',
  'invalid_bono_number',
  'material bonos cannot have an option number above one'
);

SELECT throws_ok(
  $$
    INSERT INTO public.raffle_bono_numbers (raffle_id, bono_id, option_number, numero)
    SELECT '00000000-0000-4000-8000-000000000012', id, 1, 100
    FROM public.raffle_bonos
    WHERE raffle_id = '00000000-0000-4000-8000-000000000012' AND serial = 1
  $$,
  'P0001',
  'invalid_bono_number',
  'material numbers cannot reach 100'
);

SELECT throws_ok(
  $$
    INSERT INTO public.raffle_bono_numbers (raffle_id, bono_id, option_number, numero)
    SELECT '00000000-0000-4000-8000-000000000012', id, 1, -1
    FROM public.raffle_bonos
    WHERE raffle_id = '00000000-0000-4000-8000-000000000012' AND serial = 1
  $$,
  'P0001',
  'invalid_bono_number',
  'numbers cannot be negative'
);

SELECT throws_ok(
  $$
    INSERT INTO public.raffle_bono_numbers (raffle_id, bono_id, option_number, numero)
    SELECT '00000000-0000-4000-8000-000000000012', bono_id, 1, numero
    FROM public.raffle_bono_numbers
    WHERE raffle_id = '00000000-0000-4000-8000-000000000011'
    ORDER BY numero
    LIMIT 1
  $$,
  'P0001',
  'invalid_bono_campaign',
  'a number and its bono must belong to the same campaign'
);

SELECT throws_ok(
  $$
    SELECT public.admin_update_raffle_bono(
      (SELECT id FROM public.raffle_bonos
        WHERE raffle_id = '00000000-0000-4000-8000-000000000013' AND serial = 1),
      '00000000-0000-4000-8000-000000000001',
      1,
      (SELECT jsonb_agg(candidate ORDER BY candidate)
        FROM (
          SELECT candidate
          FROM generate_series(0, 999) candidate
          WHERE NOT EXISTS (
            SELECT 1 FROM public.raffle_bono_numbers
            WHERE raffle_id = '00000000-0000-4000-8000-000000000013'
              AND numero = candidate
          )
          ORDER BY candidate
          LIMIT 2
        ) free_numbers),
      NULL, NULL, NULL, NULL
    )
  $$,
  'P0001',
  'bono_identity_locked',
  'a reserved bono identity cannot be changed'
);

SELECT throws_ok(
  $$
    SELECT public.admin_delete_raffle_bono(
      (SELECT id FROM public.raffle_bonos
        WHERE raffle_id = '00000000-0000-4000-8000-000000000013' AND serial = 1),
      '00000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'bono_active_reservation_locked',
  'an active reservation must be cancelled formally before deletion'
);

UPDATE public.raffle_bonos SET status = 'vendido'
WHERE raffle_id = '00000000-0000-4000-8000-000000000013' AND serial = 1;

SELECT throws_ok(
  $$
    SELECT public.admin_update_raffle_bono(
      (SELECT id FROM public.raffle_bonos
        WHERE raffle_id = '00000000-0000-4000-8000-000000000013' AND serial = 1),
      '00000000-0000-4000-8000-000000000001',
      1,
      (SELECT jsonb_agg(candidate ORDER BY candidate)
        FROM (
          SELECT candidate
          FROM generate_series(0, 999) candidate
          WHERE NOT EXISTS (
            SELECT 1 FROM public.raffle_bono_numbers
            WHERE raffle_id = '00000000-0000-4000-8000-000000000013'
              AND numero = candidate
          )
          ORDER BY candidate
          LIMIT 2
        ) free_numbers),
      NULL, NULL, NULL, NULL
    )
  $$,
  'P0001',
  'bono_identity_locked',
  'a sold three-digit bono identity cannot be changed'
);

SELECT throws_ok(
  $$
    SELECT public.admin_delete_raffle_bono(
      (SELECT id FROM public.raffle_bonos
        WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 3),
      '00000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'bono_financial_history_locked',
  'a paid bono cannot be deleted'
);

SELECT is(
  public.admin_delete_raffle_bono(
    (SELECT id FROM public.raffle_bonos
      WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 4),
    '00000000-0000-4000-8000-000000000001'
  )->>'status',
  'anulado',
  'a bono with administrative history is voided'
);

SELECT ok(
  (SELECT status = 'anulado'
      AND EXISTS (
        SELECT 1 FROM public.raffle_bono_events
        WHERE bono_id = raffle_bonos.id AND event_type = 'prueba_historial'
      )
    FROM public.raffle_bonos
    WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 4),
  'voiding preserves the bono and its prior events'
);

SELECT is(
  (SELECT id FROM public.raffle_bonos
    WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 5),
  (public.admin_update_raffle_bono(
    (SELECT id FROM public.raffle_bonos
      WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 5),
    '00000000-0000-4000-8000-000000000001',
    5,
    jsonb_build_array((SELECT numero FROM public.raffle_bono_numbers
      WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND bono_id = (
        SELECT id FROM public.raffle_bonos
        WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 5
      ))),
    'Comprador editado', NULL, 'Ciudad de prueba', 'Notas de prueba'
  )->>'id')::uuid,
  'an authenticated admin can edit permitted buyer details'
);

SELECT ok(
  (SELECT buyer_name = 'Comprador editado'
      AND buyer_city = 'Ciudad de prueba'
      AND buyer_notes = 'Notas de prueba'
    FROM public.raffle_bonos
    WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 5)
  AND EXISTS (
    SELECT 1 FROM public.raffle_bono_events
    WHERE bono_id = (
      SELECT id FROM public.raffle_bonos
      WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 5
    ) AND event_type = 'edicion_admin'
  ),
  'authorized edits update buyer data and append an audit event'
);

SELECT is(
  (public.admin_delete_raffle_bono(
    (SELECT id FROM public.raffle_bonos
      WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 100),
    '00000000-0000-4000-8000-000000000001'
  )->>'deleted')::boolean,
  true,
  'a bono with no operational history can be physically deleted'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.raffle_bono_events
    WHERE event_type = 'eliminacion_fisica_admin'
      AND metadata->>'deleted_bono_id' = (
        SELECT bono_id::text FROM test_physical_delete
      )
  ),
  'physical deletion writes an audit event that survives the deleted row'
);

SELECT set_config(
  'request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
SELECT throws_ok(
  $$
    SELECT public.admin_delete_raffle_bono(
      (SELECT id FROM public.raffle_bonos
        WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 6),
      '00000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'forbidden',
  'a non-admin cannot spoof an administrator actor id'
);

SELECT throws_ok(
  $$
    SELECT public.admin_delete_raffle_bono(
      (SELECT id FROM public.raffle_bonos
        WHERE raffle_id = '00000000-0000-4000-8000-000000000011' AND serial = 6),
      '00000000-0000-4000-8000-000000000002'
    )
  $$,
  'P0001',
  'forbidden',
  'an authenticated user without the admin role cannot delete bonos'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.admin_delete_raffle_bono(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.admin_delete_raffle_bono(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'service_role',
    'public.admin_delete_raffle_bono(uuid,uuid)',
    'EXECUTE'
  ),
  'administrative RPC execution is limited to authenticated sessions'
);

SELECT is(
  (SELECT count(*)::integer FROM public.tickets
    WHERE raffle_id = '00000000-0000-4000-8000-000000000014'),
  100,
  'standard raffle ticket generation remains unchanged'
);
SELECT is(
  (SELECT count(*)::integer FROM public.raffle_bonos
    WHERE raffle_id = '00000000-0000-4000-8000-000000000014'),
  0,
  'standard raffles do not generate bonos'
);

SELECT * FROM finish();
RESET ROLE;
ROLLBACK;
