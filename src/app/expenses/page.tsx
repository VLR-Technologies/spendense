import { Suspense } from "react";
import { ExpensesPage } from "@/components/expenses";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading expenses…</p>}>
      <ExpensesPage />
    </Suspense>
  );
}
