import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { RefreshCw, Undo, Redo } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const modules = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'blockquote', 'code-block'],
    ['clean']
  ]
};

export default function PolicyEditorForm({
  value,
  onChange,
  onModernize,
  onSmartEdit,
  isProcessing
}) {
  const [aiInstructions, setAiInstructions] = useState('');
  const [historyStack, setHistoryStack] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const typingTimeoutRef = useRef(null);
  const [displayCharCount, setDisplayCharCount] = useState(0);

  // Save to history
  const saveToHistory = useCallback((content) => {
    if (!content) return;
    setHistoryStack(prev => {
      const newStack = prev.slice(0, historyIndex + 1);
      newStack.push(content);
      if (newStack.length > 50) newStack.shift();
      return newStack;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Handle content change with debounced history save
  const handleContentChange = useCallback((newValue) => {
    onChange(newValue);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      saveToHistory(value);
    }, 500);
  }, [onChange, value, saveToHistory]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onChange(historyStack[newIndex]);
    }
  }, [historyIndex, historyStack, onChange]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < historyStack.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onChange(historyStack[newIndex]);
    }
  }, [historyIndex, historyStack, onChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleAiInstructionsSubmit = useCallback(async () => {
    if (!aiInstructions.trim() || aiInstructions.length > 500) return;
    saveToHistory(value);
    await onSmartEdit(value, aiInstructions.trim());
    setAiInstructions('');
  }, [aiInstructions, value, saveToHistory, onSmartEdit]);

  const handleModernize = useCallback(async () => {
    saveToHistory(value);
    await onModernize();
  }, [value, saveToHistory, onModernize]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Editor Toolbar */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={historyIndex <= 0 || isProcessing}
                className="gap-2"
              >
                <Undo className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={historyIndex >= historyStack.length - 1 || isProcessing}
                className="gap-2"
              >
                <Redo className="w-4 h-4" />
              </Button>
              <div className="w-px h-6 bg-slate-200"></div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleModernize}
                disabled={!value || isProcessing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                Modernize with AI
              </Button>
            </div>

            {/* Spacer for command input below toolbar */}
            <div className="h-1"></div>

            {/* AI Command Input - Always Visible */}
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <Input
                  value={aiInstructions}
                  onChange={e => {
                    setAiInstructions(e.target.value);
                    setDisplayCharCount(e.target.value.length);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAiInstructionsSubmit();
                    }
                  }}
                  placeholder="Type AI instruction… (ex: simplify language, add PTO rules, rewrite legally)"
                  className="text-sm rounded-md border px-3 py-2 pr-12"
                  maxLength={500}
                  disabled={isProcessing}
                />
                {displayCharCount > 0 && (
                  <span className={`text-xs absolute bottom-2.5 right-3 ${displayCharCount > 450 ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>{displayCharCount}/500</span>
                )}
              </div>
              <Button
                size="sm"
                onClick={handleAiInstructionsSubmit}
                disabled={!aiInstructions.trim() || aiInstructions.length > 500 || isProcessing}
                className="gap-2"
                title={aiInstructions.length > 500 ? "Instruction too long (max 500 chars)" : ""}
              >
                {isProcessing && <RefreshCw className="w-3 h-3 animate-spin" />}
                Apply
              </Button>
            </div>

            {/* Rich Editor */}
              <div className="min-h-[300px] border border-slate-200 rounded-lg overflow-hidden bg-white editor-wrapper">
                <ReactQuill
                 theme="snow"
                 value={value}
                 onChange={handleContentChange}
                 modules={modules}
                 placeholder="Start typing or paste content here..."
                 readOnly={isProcessing}
               />
             </div>

            {isProcessing && (
              <p className="text-xs text-amber-600">Processing AI task... this may take a moment.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}