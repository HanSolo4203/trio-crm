import { AppShell } from "@/components/AppShell";
import { ContactDetail } from "@/components/ContactDetail";

export default function ContactPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <ContactDetail contactId={params.id} />
    </AppShell>
  );
}
