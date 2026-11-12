import { FaShell } from "@/components/fa/FaShell";
import { requireFa } from "@/lib/fa/guard";
import { UploadClient } from "./UploadClient";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const ctx = await requireFa({ edit: true });
  return (
    <FaShell ctx={ctx} title="Upload report" sub="Add the vendor PDF for a heat. The system reads it; you check the readings and confirm.">
      <UploadClient />
    </FaShell>
  );
}
