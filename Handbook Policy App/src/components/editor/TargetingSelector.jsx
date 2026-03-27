import React from 'react';
import { Label } from "@/components/ui/label";

/**
 * Reusable targeting selector for roles, departments, and locations.
 * Extracts complex nested state logic from PolicyEditor to reduce complexity.
 */
export default function TargetingSelector({ 
  targetType,
  options, 
  selectedItems, 
  onToggle 
}) {
  const colorClasses = {
    roles: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:border-indigo-200',
    departments: 'bg-violet-50 border-violet-200 text-violet-700 hover:border-violet-200',
    locations: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-200'
  };

  const unselectedClass = 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200';
  const activeClass = colorClasses[targetType];

  return (
    <div className="space-y-2">
      <Label>Target {targetType.charAt(0).toUpperCase() + targetType.slice(1)}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map(item => {
          const id = item.id || item;
          const label = item.name || item;
          const isSelected = selectedItems.includes(id);

          return (
            <button
              key={id}
              onClick={() => onToggle(id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                isSelected ? activeClass : unselectedClass
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}