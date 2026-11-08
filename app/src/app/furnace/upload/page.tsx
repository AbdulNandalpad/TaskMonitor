import { FaShell } from "@/components/fa/FaShell";
import { requireFa } from "@/lib/fa/guard";
import { UploadClient } from "./UploadClient";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const ctx = await requireFa({ edit: true });
  return (
    <FaShell ctx={ctx} title="Upload report" sub="Choose one or more vendor report PDFs. Each is read, shown to you to check, and saved only when you confirm.">
      <UploadClient />
    </FaShell>
  );
}
