import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from '@/api/client';
import { formatPolicyContent } from './formatPolicyContent';

export default function ImportCard({ onContentLoaded, onMetadataExtracted, isLoading }) {
  const [uploading, setUploading] = useState(false);

  const MAX_FILE_SIZE_MB = 10;
  const ALLOWED_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'text/plain'];

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Unsupported file type. Please upload a PDF, Word, image, or text file.');
      return;
    }

    setUploading(true);
    try {
      let rawText = '';
      if (file.type === 'text/plain') {
        rawText = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : (reader.result ? '' : ''));
          reader.onerror = reject;
          reader.readAsText(file);
        });
      } else {
        alert('Import currently supports text files only. PDF/Word extraction requires server configuration.');
        return;
      }

      if (!rawText || rawText.trim().length === 0) {
        alert('No content extracted from file');
        return;
      }

      const aiExtraction = await api.invokeLLM({
          prompt: `Extract policy information from this document.

Return ONLY valid JSON:
{
"title": "Concise policy title (2-5 words)",
"description": "One sentence summary",
"policy_content": "Clean, readable policy content with the actual rules and guidelines (remove boilerplate, numbering, formatting artifacts)"
}

DOCUMENT:
${rawText}`,
          add_context_from_internet: false
        });

        let metadata = { suggested_title: null, suggested_description: null };
        let policyContent = rawText;

        if (aiExtraction) {
          try {
            const parsed = typeof aiExtraction === 'string' ? JSON.parse(aiExtraction) : aiExtraction;
            metadata = {
              suggested_title: parsed.title || null,
              suggested_description: parsed.description || null
            };
            policyContent = parsed.policy_content || rawText;
          } catch (e) {
            console.warn('AI extraction failed, using raw text');
          }
        }

      const formatted = formatPolicyContent(policyContent, "import");
      onContentLoaded(formatted);
      if (onMetadataExtracted) {
        onMetadataExtracted(metadata);
      }
    } catch (error) {
      console.error('File upload failed:', error);
      alert('Failed to upload or extract file');
    } finally {
      setUploading(false);
    }
  };



  return (
    <Card>
      <CardContent className="p-6">
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-900 mb-1">Upload Policy Document</p>
          <p className="text-xs text-slate-500 mb-4">PDF, Word, Image, or Text file</p>
          <label>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading || isLoading}
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
            />
            <Button
              variant="outline"
              asChild
              disabled={uploading || isLoading}
            >
              <span>{uploading ? 'Uploading...' : 'Choose File'}</span>
            </Button>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}