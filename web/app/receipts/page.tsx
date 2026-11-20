import { ReceiptsList } from "@/components/receipts/ReceiptsList";
import { PageTitle } from "@/components/ui";

export default function ReceiptsPage() {
  return (
    <div>
      <PageTitle emoji="🧾" title="Receipts" subtitle="Every step: how you asked, what Milo understood, how sure it was, what you confirmed, and the evidence." />
      <ReceiptsList />
    </div>
  );
}
