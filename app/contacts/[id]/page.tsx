import { AppShell } from "@/components/AppShell";
import { ContactDetail } from "@/components/ContactDetail";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <ContactDetail contactId={id} />
    </AppShell>
  );
}
