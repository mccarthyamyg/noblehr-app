import { cn } from "@/lib/utils";

export default function StatCard({ label, value, icon: Icon, trend, color = "emerald" }) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-6 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
            trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
          )}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}