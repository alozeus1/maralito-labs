// Protected by the (admin) layout guard (staff only). Phase 2 placeholder: order triage list via
// adminListOrders. No quote/payment/inspection actions in Phase 2.
export default function AdminOrdersPage() {
  return (
    <main className="p-6">
      <h1 className="font-heading text-2xl">Orders</h1>
      <p className="text-on-surface-variant mt-2">
        Order triage (Phase 2 foundation — read + advance/hold).
      </p>
    </main>
  );
}
