import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';

export default function PolicyDiffViewer({ oldVersion, newVersion }) {
  if (!oldVersion || !newVersion) {
    return (
      <Card className="p-8 text-center">
        <p className="text-slate-500">Select two versions to compare</p>
      </Card>
    );
  }

  // Simple diff: split by lines and compare
  const oldLines = stripHtml(oldVersion.content).split('\n').filter(l => l.trim());
  const newLines = stripHtml(newVersion.content).split('\n').filter(l => l.trim());

  const diff = computeDiff(oldLines, newLines);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Badge variant="outline">Version {oldVersion.version_number}</Badge>
          <p className="text-xs text-slate-500 mt-1">
            {format(new Date(oldVersion.created_date), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
        <div className="text-slate-400">→</div>
        <div>
          <Badge variant="outline">Version {newVersion.version_number}</Badge>
          <p className="text-xs text-slate-500 mt-1">
            {format(new Date(newVersion.created_date), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-1 font-mono text-sm">
          {diff.map((line, idx) => (
            <div
              key={idx}
              className={`py-1 px-2 rounded ${
                line.type === 'added' ? 'bg-green-50 text-green-900' :
                line.type === 'removed' ? 'bg-red-50 text-red-900' :
                'text-slate-700'
              }`}
            >
              <span className="mr-2 text-slate-400">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              {line.text}
            </div>
          ))}
        </div>
      </Card>

      {newVersion.change_summary && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-sm font-medium text-blue-900 mb-1">Change Summary</p>
          <p className="text-sm text-blue-700">{newVersion.change_summary}</p>
        </Card>
      )}
    </div>
  );
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function computeDiff(oldLines, newLines) {
  const result = [];
  let i = 0, j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      result.push({ type: 'added', text: newLines[j] });
      j++;
    } else if (j >= newLines.length) {
      result.push({ type: 'removed', text: oldLines[i] });
      i++;
    } else if (oldLines[i] === newLines[j]) {
      result.push({ type: 'unchanged', text: oldLines[i] });
      i++;
      j++;
    } else {
      // Look ahead to find matching line
      const oldInNew = newLines.slice(j).indexOf(oldLines[i]);
      const newInOld = oldLines.slice(i).indexOf(newLines[j]);

      if (oldInNew !== -1 && (newInOld === -1 || oldInNew < newInOld)) {
        result.push({ type: 'added', text: newLines[j] });
        j++;
      } else {
        result.push({ type: 'removed', text: oldLines[i] });
        i++;
      }
    }
  }

  return result;
}