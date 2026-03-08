import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface DetailField {
  label: string;
  value: React.ReactNode;
}

interface ViewDetailDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: DetailField[];
}

export default function ViewDetailDialog({ open, onClose, title, fields }: ViewDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <span className="text-sm font-medium text-muted-foreground col-span-1">{f.label}</span>
              <span className="text-sm col-span-2">{f.value || "—"}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
