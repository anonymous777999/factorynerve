import { SteelCustomerLedgerWorkspace } from "@/features/steel";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SteelCustomerLedgerRoute({ params }: Props) {
  const resolved = await params;
  return <SteelCustomerLedgerWorkspace customerId={Number(resolved.id)} />;
}
