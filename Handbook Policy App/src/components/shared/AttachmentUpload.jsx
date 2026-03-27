import React, { useState } from 'react';
import { Upload, X, File, Loader2 } from 'lucide-react';

export default function AttachmentUpload({ attachments = [], onAttachmentsChange, disabled = false }) {
  const [uploading, setUploading] = useState(false);

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    try {
      for (const file of files) {
        // File upload - add /api/upload endpoint for production
        const reader = new FileReader();
        reader.onload = () => onAttachmentsChange([...attachments, { name: file.name, url: reader.result }]);
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(index) {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label htmlFor="attachment-upload" className="flex-1">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition text-center">
            <div className="flex items-center justify-center gap-2">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  <span className="text-sm text-slate-600">Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Click to upload or drag files</span>
                </>
              )}
            </div>
          </div>
        </label>
        <input
          id="attachment-upload"
          type="file"
          multiple
          onChange={handleFileSelect}
          disabled={uploading || disabled}
          className="hidden"
          accept="*"
        />
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 font-medium">Attached Files ({attachments.length})</p>
          <div className="space-y-1">
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 flex-1 min-w-0 hover:text-indigo-600"
                >
                  <File className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                  <span className="text-xs text-slate-700 truncate">{att.name}</span>
                </a>
                <button
                  onClick={() => removeAttachment(idx)}
                  disabled={uploading || disabled}
                  className="p-1 hover:bg-red-100 rounded transition flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}