/**
 * Permissive types for shadcn/Radix UI components so JSX usage type-checks.
 * Components accept children and common props.
 */
import type * as React from 'react';

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };
type FCAny = React.ForwardRefExoticComponent<AnyProps>;

declare module '@/components/ui/button' {
  export const Button: FCAny;
  export const buttonVariants: (options?: unknown) => string;
}

declare module '@/components/ui/card' {
  export const Card: FCAny;
  export const CardContent: FCAny;
  export const CardHeader: FCAny;
  export const CardTitle: FCAny;
  export const CardDescription: FCAny;
}

declare module '@/components/ui/input' {
  export const Input: React.ForwardRefExoticComponent<AnyProps & { value?: string; onChange?: (e: unknown) => void; placeholder?: string; disabled?: boolean; className?: string; maxLength?: number }>;
}

declare module '@/components/ui/textarea' {
  export const Textarea: React.ForwardRefExoticComponent<AnyProps & { value?: string; onChange?: (e: unknown) => void; placeholder?: string; disabled?: boolean; rows?: number }>;
}

declare module '@/components/ui/label' {
  export const Label: FCAny;
}

declare module '@/components/ui/dialog' {
  export const Dialog: FCAny;
  export const DialogContent: FCAny;
  export const DialogHeader: FCAny;
  export const DialogTitle: FCAny;
  export const DialogDescription: FCAny;
  export const DialogFooter: FCAny;
}

declare module '@/components/ui/tabs' {
  export const Tabs: FCAny;
  export const TabsList: FCAny;
  export const TabsTrigger: FCAny;
  export const TabsContent: FCAny;
}

declare module '@/components/ui/select' {
  export const Select: FCAny;
  export const SelectTrigger: FCAny;
  export const SelectValue: FCAny;
  export const SelectContent: FCAny;
  export const SelectItem: FCAny;
}

declare module '@/components/ui/table' {
  export const Table: FCAny;
  export const TableHeader: FCAny;
  export const TableBody: FCAny;
  export const TableRow: FCAny;
  export const TableHead: FCAny;
  export const TableCell: FCAny;
}

declare module '@/components/ui/badge' {
  export const Badge: FCAny;
}

declare module '@/components/ui/switch' {
  export const Switch: FCAny;
}

declare module '@/components/ui/accordion' {
  export const Accordion: FCAny;
  export const AccordionItem: FCAny;
  export const AccordionTrigger: FCAny;
  export const AccordionContent: FCAny;
}

declare module '@/components/ui/alert-dialog' {
  export const AlertDialog: FCAny;
  export const AlertDialogTrigger: FCAny;
  export const AlertDialogContent: FCAny;
  export const AlertDialogHeader: FCAny;
  export const AlertDialogTitle: FCAny;
  export const AlertDialogDescription: FCAny;
  export const AlertDialogFooter: FCAny;
  export const AlertDialogAction: FCAny;
  export const AlertDialogCancel: FCAny;
}
