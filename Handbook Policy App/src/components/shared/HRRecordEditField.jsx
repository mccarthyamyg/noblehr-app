import React, { useState } from 'react';
import { api } from '@/api/client';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function HRRecordEditField({ record, field, org, onSave }) {
  const [value, setValue] = useState(record[field] || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await api.invoke('secureEntityWrite', {
      action: 'amend',
      entity_type: 'HRRecord',
      organization_id: org.id,
      entity_id: record.id,
      field_changed: field,
      old_value: record[field] || '',
      new_value: value,
      amendment_note: note
    });
    setSaving(false);
    onSave();
  }

  return (
    <div className="space-y-3">
      {field === 'description' ? (
        <Textarea value={value} onChange={e => setValue(e.target.value)} rows={6} />
      ) : (
        <Input value={value} onChange={e => setValue(e.target.value)} />
      )}
      <div>
        <label className="text-xs text-slate-600 mb-1 block">Reason for amendment (optional)</label>
        <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Why was this changed?" className="text-xs" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => setValue(record[field] || '')}>Reset</Button>
        <Button className="bg-indigo-600 hover:bg-indigo-700" size="sm" onClick={handleSave} disabled={saving || value === record[field]}>
          {saving ? 'Saving...' : 'Save Amendment'}
        </Button>
      </div>
    </div>
  );
}