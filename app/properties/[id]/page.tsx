import { AppShell } from "@/components/AppShell";
import { PropertyDetail } from "@/components/PropertyDetail";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <PropertyDetail propertyId={id} />
    </AppShell>
  );
}
