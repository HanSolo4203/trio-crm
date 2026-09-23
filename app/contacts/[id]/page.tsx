import { ContactDetail } from "@/components/ContactDetail";
import { Sidebar } from "@/components/Sidebar";

export default function ContactPage({ params }: { params: { id: string } }) {
  return (
    <>
      <Sidebar />
      <div className="min-h-screen pl-[234px]">
        <main className="mx-auto max-w-[1600px] px-10 py-8">
          <ContactDetail contactId={params.id} />
        </main>
      </div>
    </>
  );
}
