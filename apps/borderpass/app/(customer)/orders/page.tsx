// Protected by the (customer) layout guard. Phase 2 placeholder: lists orders via listMyOrders
// (server action) once a live DB is configured. No payment/inspection UI in Phase 2.
export default function OrdersPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-heading text-2xl">Your orders</h1>
      <p className="text-on-surface-variant mt-2">
        Orders list (Phase 2 foundation — wired to data with a live DB).
      </p>
    </main>
  );
}
