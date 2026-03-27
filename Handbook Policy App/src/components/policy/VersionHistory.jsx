import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, GitCompare } from 'lucide-react';
import { format } from 'date-fns';

export default function VersionHistory({ versions, onCompare }) {
  const [selectedVersions, setSelectedVersions] = useState([]);

  function toggleVersion(version) {
    if (selectedVersions.find(v => v.id === version.id)) {
      setSelectedVersions(selectedVersions.filter(v => v.id !== version.id));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, version]);
    } else {
      setSelectedVersions([selectedVersions[1], version]);
    }
  }

  function handleCompare() {
    if (selectedVersions.length === 2) {
      const sorted = [...selectedVersions].sort((a, b) => a.version_number - b.version_number);
      onCompare(sorted[0], sorted[1]);
      setSelectedVersions([]);
    }
  }

  return (
    <div className="space-y-4">
      {selectedVersions.length === 2 && (
        <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-200">
          <p className="text-sm text-indigo-900">
            Comparing v{selectedVersions[0].version_number} and v{selectedVersions[1].version_number}
          </p>
          <Button size="sm" onClick={handleCompare} className="bg-indigo-600 hover:bg-indigo-700">
            <GitCompare className="w-4 h-4 mr-2" />
            View Diff
          </Button>
        </div>
      )}

      {selectedVersions.length > 0 && selectedVersions.length < 2 && (
        <p className="text-xs text-slate-500">
          Select one more version to compare
        </p>
      )}

      <div className="space-y-3">
        {versions.map(v => {
          const isSelected = selectedVersions.find(sv => sv.id === v.id);
          return (
            <button
              key={v.id}
              onClick={() => toggleVersion(v)}
              className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${
                isSelected 
                  ? 'border-indigo-300 bg-indigo-50/50' 
                  : 'border-slate-200/60 bg-slate-50/50 hover:border-slate-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isSelected ? 'bg-indigo-100' : 'bg-indigo-50'
              }`}>
                <History className={`w-4 h-4 ${isSelected ? 'text-indigo-700' : 'text-indigo-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">Version {v.version_number}</span>
                  {v.is_current && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Current</Badge>}
                  {isSelected && <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">Selected</Badge>}
                </div>
                <p className="text-xs text-slate-500 mt-1">{v.change_summary || 'No change summary'}</p>
                <p className="text-xs text-slate-400 mt-1">
                  by {v.author_name} · {format(new Date(v.created_date), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}