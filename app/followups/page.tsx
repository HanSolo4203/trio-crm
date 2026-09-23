import { Followups } from "@/components/Followups";
import { Sidebar } from "@/components/Sidebar";

export default function FollowupsPage() {
  return (
    <>
      <Sidebar />
      <div className="min-h-screen pl-[234px]">
        <main className="mx-auto max-w-[1600px] px-10 py-8">
          <Followups />
        </main>
      </div>
    </>
  );
}
