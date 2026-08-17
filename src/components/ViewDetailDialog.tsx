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
          <DialogDescription className="sr-only">Detailed view of {title}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 py-2">
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-3 items-start gap-3">
              <span className="col-span-1 text-[13px] font-medium leading-[1.55] text-muted-foreground">{f.label}</span>
              <span className="col-span-2 text-sm leading-[1.55]">{f.value || "—"}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
