import { format } from 'date-fns';

export default function HRRecordAmendmentLog({ recordId, amendments }) {
  const recordAmendments = amendments.filter(a => a.record_id === recordId);

  if (recordAmendments.length === 0) return null;

  return (
    <div className="border-t pt-4 space-y-3">
      <p className="text-xs uppercase tracking-wide text-slate-600 font-medium">Amendment Log</p>
      <div className="space-y-2">
        {recordAmendments.map(amend => (
          <div key={amend.id} className="border border-slate-200 rounded-lg p-3 text-xs space-y-2 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">{amend.field_changed}</span>
              <span className="text-slate-500">{format(new Date(amend.created_date), 'MMM d, h:mm a')}</span>
            </div>
            <div className="text-slate-600">By: {amend.amended_by_name}</div>
            {amend.old_value && (
              <div className="bg-red-50 border border-red-100 p-2 rounded text-red-700">
                <span className="font-medium">Was:</span> {amend.old_value}
              </div>
            )}
            <div className="bg-green-50 border border-green-100 p-2 rounded text-green-700">
              <span className="font-medium">Now:</span> {amend.new_value}
            </div>
            {amend.amendment_note && (
              <div className="text-slate-700 italic">"{amend.amendment_note}"</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}