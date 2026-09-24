import { AppShell } from "@/components/AppShell";
import { ContractorDetail } from "@/components/ContractorDetail";

export default async function ContractorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <ContractorDetail contractorId={id} />
    </AppShell>
  );
}
