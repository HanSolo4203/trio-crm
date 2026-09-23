import { Pipeline } from "@/components/Pipeline";
import { Sidebar } from "@/components/Sidebar";

export default function PipelinePage() {
  return (
    <>
      <Sidebar />
      <div className="min-h-screen pl-[234px]">
        <main className="mx-auto max-w-[1600px] px-10 py-8">
          <Pipeline />
        </main>
      </div>
    </>
  );
}
