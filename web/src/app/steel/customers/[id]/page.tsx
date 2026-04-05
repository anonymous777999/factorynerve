import { SteelCustomerLedgerPage } from "@/components/steel-customer-ledger-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SteelCustomerLedgerRoute({ params }: Props) {
  const resolved = await params;
  return <SteelCustomerLedgerPage customerId={Number(resolved.id)} />;
}
