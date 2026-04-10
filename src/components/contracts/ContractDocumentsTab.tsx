import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, FileText, ExternalLink, Upload } from "lucide-react";
import { useContractLinks, useContractDocuments, useContractMutations } from "@/hooks/useContracts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatUrl } from "@/lib/formatUrl";

interface Props {
  contractId: string;
}

export default function ContractDocumentsTab({ contractId }: Props) {
  const { data: links = [] } = useContractLinks(contractId);
  const { data: documents = [] } = useContractDocuments(contractId);
  const { addLink, deleteLink, addDocument, deleteDocument } = useContractMutations();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({ title: "", url: "" });
  const [uploading, setUploading] = useState(false);

  function handleAddLink() {
    if (!linkForm.url) return;
    addLink.mutate({ contract_id: contractId, title: linkForm.title || null, url: formatUrl(linkForm.url) });
    setLinkForm({ title: "", url: "" });
    setShowLinkForm(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Only PDF files are allowed"); return; }
    setUploading(true);
    const path = `${contractId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("contract-documents").upload(path, file);
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("contract-documents").getPublicUrl(path);
    addDocument.mutate({ contract_id: contractId, file_url: urlData.publicUrl, file_name: file.name });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      {/* Links Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">External Links</h4>
          <Button size="sm" variant="outline" onClick={() => setShowLinkForm(true)} disabled={showLinkForm}>
            <Plus className="mr-1 h-3 w-3" /> Add Link
          </Button>
        </div>

        {showLinkForm && (
          <div className="grid grid-cols-3 gap-3 items-end rounded-lg border p-3 bg-muted/30">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={linkForm.title} onChange={(e) => setLinkForm((f) => ({ ...f, title: e.target.value }))} className="h-8" placeholder="Label..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL *</Label>
              <Input value={linkForm.url} onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))} className="h-8" placeholder="https://..." />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-8" onClick={handleAddLink} disabled={!linkForm.url}>Add</Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowLinkForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {links.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">No links added</p>
        ) : (
          <div className="space-y-1">
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-2 group text-sm">
                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                  {l.title || l.url}
                </a>
                <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive shrink-0" onClick={() => deleteLink.mutate(l.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Documents (PDF)</h4>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="mr-1 h-3 w-3" /> {uploading ? "Uploading..." : "Upload PDF"}
          </Button>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
        </div>

        {documents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">No documents uploaded</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-red-500 shrink-0" />
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                      {d.file_name}
                    </a>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteDocument.mutate(d.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
