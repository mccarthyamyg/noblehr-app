import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const variants = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  archived: "bg-amber-50 text-amber-700 border-amber-200",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  under_review: "bg-violet-50 text-violet-700 border-violet-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  dismissed: "bg-slate-100 text-slate-500 border-slate-200",
  low: "bg-blue-50 text-blue-600 border-blue-200",
  medium: "bg-amber-50 text-amber-600 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-red-50 text-red-700 border-red-200",
  employee: "bg-slate-100 text-slate-600 border-slate-200",
  manager: "bg-indigo-50 text-indigo-700 border-indigo-200",
  org_admin: "bg-purple-50 text-purple-700 border-purple-200",
  terminated: "bg-red-50 text-red-600 border-red-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
};

const labels = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
  submitted: "Submitted",
  under_review: "Under Review",
  resolved: "Resolved",
  dismissed: "Dismissed",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  employee: "Employee",
  manager: "Manager",
  org_admin: "Org Admin",
  write_up: "Write-Up",
  incident_report: "Incident Report",
  hr_note: "HR Note",
  termination: "Termination",
  document: "Document",
  workplace_complaint: "Workplace Complaint",
  altercation: "Altercation",
  safety_incident: "Safety Incident",
  guest_injury: "Guest Injury",
  other: "Other",
  terminated: "Terminated",
  inactive: "Inactive",
};

export default function StatusBadge({ status, className }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium px-2 py-0.5 rounded-full border capitalize",
        variants[status] || "bg-slate-100 text-slate-600 border-slate-200",
        className
      )}
    >
      {labels[status] || status?.replace(/_/g, ' ')}
    </Badge>
  );
}