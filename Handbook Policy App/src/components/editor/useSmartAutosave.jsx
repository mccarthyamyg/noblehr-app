import { useEffect, useRef, useState } from 'react';

/**
 * Smart autosave hook - word-style idle-based saving
 * Saves ONLY when editor is idle (30 seconds of no changes)
 * Does NOT save while AI tasks are running
 * Prevents rate limiting by reducing save frequency
 */
export function useSmartAutosave(content, onSave, isProcessing = false) {
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const contentRef = useRef(content);
  const onSaveRef = useRef(onSave);
  const timeoutRef = useRef(null);
  const isInitializedRef = useRef(false);
  const lastSavedContentRef = useRef(content);
  const isMountedRef = useRef(true);

  // Keep refs in sync — avoids stale closures without re-triggering the effect
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  useEffect(() => {
    contentRef.current = content;
    if (!isInitializedRef.current) {
      lastSavedContentRef.current = content;
      isInitializedRef.current = true;
    }
  }, [content]);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (isProcessing) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    if (contentRef.current === lastSavedContentRef.current) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      setIsSaving(true);
      try {
         await onSaveRef.current(true);
         if (!isMountedRef.current) return;
         lastSavedContentRef.current = contentRef.current;
         setLastSaved(new Date());
         setSaveError(null);
       } catch (error) {
         console.error('Autosave failed:', error);
         if (isMountedRef.current) {
           setSaveError(error.message || 'Autosave failed. Changes may not be saved.');
         }
       } finally {
         if (isMountedRef.current) setIsSaving(false);
       }
    }, 60000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [content, isProcessing]); // onSave intentionally excluded — using ref instead

  return { lastSaved, isSaving, saveError };
}