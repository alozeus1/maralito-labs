/**
 * LIVE Supabase RLS gate (Phase 7, ADR-0013) — runs cross-domain tenant-isolation checks against a
 * REAL Postgres/Supabase project. NON-DESTRUCTIVE: it seeds ephemeral rows inside ONE transaction and
 * ROLLS THE WHOLE TRANSACTION BACK at the end, so nothing persists (safe to run against any environment
 * where you accept a transient transaction). Run in a real env ONLY:
 *
 *   DATABASE_URL=postgres://... pnpm --filter @maralito/db gate:rls
 *
 * Preconditions (operator): migrations applied + ALL policy files applied
 *   (policies.sql, orders/quotes/payments/notifications/inspections/delivery-preparations-policies.sql)
 *   + the connection role is the table OWNER (so the privileged seed bypasses RLS) and can assume the
 *   `authenticated` role. Exits non-zero on ANY failure. Do NOT mark the live gate passed unless this
 *   prints ALL PASS on the real project.
 *
 * This script ASSERTS RLS — it does not create tables/policies (the operator applies those first).
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL required'); process.exit(2); }
const sql = postgres(url, { prepare: false, max: 1 });

let pass = 0, fail = 0;
const check = (n: string, ok: boolean, note = '') => { (ok ? pass++ : fail++); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${note ? ' — ' + note : ''}`); };

const A = '00000000-0000-4000-8000-0000000007a0';
const B = '00000000-0000-4000-8000-0000000007b0';
const OPS = '00000000-0000-4000-8000-00000000070b';
class Rollback extends Error {}

/** Run `fn` as a tenant (or anon) inside a savepoint that always rolls back, resetting role+claims. */
async function asTenant<T>(tx: postgres.TransactionSql, sub: string | null, fn: (q: postgres.TransactionSql) => Promise<T>): Promise<T> {
  let out: T;
  try {
    await tx.savepoint(async (sp) => {
      if (sub) await sp`select set_config('request.jwt.claims', ${JSON.stringify({ sub, role: 'authenticated' })}, true)`;
      await sp`set local role authenticated`;
      out = await fn(sp);
      throw new Rollback(); // undo role/claims for the next check
    });
  } catch (e) { if (!(e instanceof Rollback)) throw e; }
  return out!;
}
const count = async (q: postgres.TransactionSql, table: string, where = '') =>
  Number((await q.unsafe(`select count(*)::int n from ${table} ${where}`))[0].n);

async function main() {
  // 1-3. connection + role assumption + claims read
  try { await sql`select 1`; check('1 DATABASE_URL connection', true); } catch (e) { check('1 DATABASE_URL connection', false, String(e)); }
  let canAssume = false;
  try { await sql.begin(async (tx) => { await tx`set local role authenticated`; await tx`reset role`; }); canAssume = true; } catch (e) { check('2 SET LOCAL ROLE authenticated', false, String(e)); }
  if (canAssume) check('2 SET LOCAL ROLE authenticated', true);
  try {
    const uid = await sql.begin((tx) => asTenant(tx, A, (q) => q`select auth.uid() as uid`.then((r) => r[0].uid)));
    check('3 request.jwt.claims read by auth.uid()', uid === A);
  } catch (e) { check('3 request.jwt.claims read by auth.uid()', false, String(e)); }

  // 4-N. cross-domain isolation — seed two customers + a full order chain each, assert, then ROLL BACK.
  try {
    await sql.begin(async (tx) => {
      // Privileged seed (connection role = owner → bypasses RLS). All rolled back at the end.
      await tx`insert into organizations(id,name) values('org_gate','GATE')`;
      await tx`insert into user_identities(id,auth_user_id,org_id) values('uig_a',${A},'org_gate'),('uig_b',${B},'org_gate'),('uig_ops',${OPS},'org_gate')`;
      await tx`insert into customer_profiles(id,auth_user_id,org_id,display_name) values('cg_a',${A},'org_gate','A'),('cg_b',${B},'org_gate','B')`;
      await tx`insert into staff_profiles(id,auth_user_id,org_id,display_name) values('sg_ops',${OPS},'org_gate','Ops')`;
      // Self-seed the role keys the gate references so it does not depend on db:seed having run first
      // (user_roles.role_key -> roles.key FK). Rolled back with the rest of the transaction.
      await tx`insert into roles(key,name) values('customer','customer'),('operations_manager','operations_manager') on conflict (key) do nothing`;
      await tx`insert into user_roles(id,auth_user_id,org_id,role_key) values('urg_a',${A},'org_gate','customer'),('urg_b',${B},'org_gate','customer'),('urg_ops',${OPS},'org_gate','operations_manager')`;
      for (const [o, c] of [['og_a', 'cg_a'], ['og_b', 'cg_b']]) {
        await tx`insert into orders(id,order_ref,customer_id,org_id,service_type,status,correlation_id) values(${o},${'BP-' + o},${c},'org_gate','buy_for_me','inspection_pending',${o})`;
        await tx`insert into quotes(id,order_id,customer_id,org_id,status,total_minor) values(${'qg_' + o},${o},${c},'org_gate','accepted',10000)`;
        await tx`insert into payments(id,org_id,customer_id,order_id,quote_id,status,amount_minor,idempotency_key) values(${'pg_' + o},'org_gate',${c},${o},${'qg_' + o},'succeeded',10000,${'pi_' + o})`;
        await tx`insert into inspections(id,org_id,customer_id,order_id,status,staff_notes,customer_summary) values(${'ig_' + o},'org_gate',${c},${o},'in_progress','internal','progress')`;
        await tx`insert into inspection_status_history(id,org_id,inspection_id,order_id,to_status) values(${'ihg_' + o},'org_gate',${'ig_' + o},${o},'in_progress')`;
        await tx`insert into delivery_preparations(id,org_id,customer_id,order_id,status,delivery_address_ref) values(${'dg_' + o},'org_gate',${c},${o},'preparing','addr_ref')`;
        await tx`insert into notification_outbox(id,org_id,customer_id,order_id,inspection_id,channel,template_key,idempotency_key) values(${'ng_' + o},'org_gate',${c},${o},${'ig_' + o},'lifecycle_placeholder','inspection_update',${'inspection_update:' + 'ig_' + o + ':passed'})`;
      }

      const domains = ['orders', 'quotes', 'payments', 'inspections', 'delivery_preparations', 'notification_outbox'];
      for (const t of domains) {
        const aOwn = await asTenant(tx, A, (q) => count(q, t, `where org_id='org_gate'`));
        const aSeesB = await asTenant(tx, A, (q) => count(q, t, `where org_id='org_gate' and customer_id='cg_b'`));
        check(`iso ${t}: customer A sees only own`, aOwn === 1 && aSeesB === 0, `own=${aOwn} sawB=${aSeesB}`);
      }
      // staff org-scoped read
      const opsOrders = await asTenant(tx, OPS, (q) => count(q, 'orders', `where org_id='org_gate'`));
      check('iso orders: ops sees both org orders', opsOrders === 2, `n=${opsOrders}`);
      // history staff-only
      const aHist = await asTenant(tx, A, (q) => count(q, 'inspection_status_history', `where org_id='org_gate'`));
      const opsHist = await asTenant(tx, OPS, (q) => count(q, 'inspection_status_history', `where org_id='org_gate'`));
      check('iso inspection history: customer 0, staff sees', aHist === 0 && opsHist === 2, `cust=${aHist} ops=${opsHist}`);
      // customer write-deny (no update policy on payments → 0 rows)
      const upd = await asTenant(tx, A, (q) => q.unsafe(`update payments set status='failed' where org_id='org_gate' and customer_id='cg_a' returning id`));
      check('write-deny payments: customer update 0 rows', upd.length === 0, `rows=${upd.length}`);
      // missing claims → 0
      const anon = await asTenant(tx, null, (q) => count(q, 'orders', `where org_id='org_gate'`));
      check('missing claims → 0 orders', anon === 0, `n=${anon}`);

      throw new Rollback(); // undo the entire seed — non-destructive
    });
  } catch (e) { if (!(e instanceof Rollback)) check('isolation block', false, String(e)); }

  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end();
  process.exit(fail === 0 ? 0 : 1);
}
main();
