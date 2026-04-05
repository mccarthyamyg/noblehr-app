import React, { useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from '@/api/client';

export default function SmartGeneratorDialog({ open, onOpenChange, onGenerate, hasExistingContent, organization, orgId, userEmail }) {
  const [mode, setMode] = useState(hasExistingContent ? 'topic' : 'guided');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [askingQuestions, setAskingQuestions] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [suggestedPolicies, setSuggestedPolicies] = useState([]);


  const commonPolicies = [
    'Request Off / Time Off Policy',
    'Dress Code',
    'Break & Meal Period Policy',
    'Attendance & Punctuality',
    'Safety & Workplace Conduct',
    'Social Media Policy',
    'Confidentiality & Proprietary Information',
    'Performance Review Process'
  ];

  const checkGuard = async () => {
    if (!orgId) return true; // Skip guard if not provided
    const guard = await api.invoke('guardAiUsage', {
      organization_id: orgId
    });
    if (!guard?.allowed && guard?.data?.allowed !== true) {
      alert(guard?.message || guard?.data?.message || 'AI generation is not allowed or limit reached.');
      return false;
    }
    return true;
  };

  const handleAskQuestions = async () => {
    if (!topic.trim()) return;
    if (!(await checkGuard())) return;
    setGenerating(true);
    try {
      const businessContext = organization?.industry ? `\nBusiness: ${organization.industry}` : '';
      const prompt = `You are helping gather information about a workplace policy topic.

Topic: ${topic}${businessContext}
${notes ? `Context: ${notes}` : ''}

Generate 3-4 brief, specific clarifying questions to better understand this policy's requirements.
Questions should focus on operational details, scope, and business-specific needs for a ${organization?.industry || 'small business'}.

Return ONLY a JSON array:
["Question 1?", "Question 2?", "Question 3?"]`;

      const result = await api.invokeLLM({
        prompt,
        add_context_from_internet: false
      });

      if (result) {
        try {
          const parsed = typeof result === 'string' ? JSON.parse(result) : result;
          setQuestions(Array.isArray(parsed) ? parsed : []);
          setAskingQuestions(true);
        } catch (e) {
          console.error('Failed to parse questions:', e);
          alert('Failed to parse questions');
        }
      }
    } catch (error) {
      console.error('Question generation failed:', error);
      alert('Failed to generate questions');
    } finally {
      setGenerating(false);
    }
  };

  const handleAuditAndGenerate = async () => {
    if (!topic.trim() || Object.keys(answers).length === 0) return;
    if (!(await checkGuard())) return;
    setGenerating(true);
    try {
      const answersText = questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || ''}`).join('\n\n');
      
      const auditPrompt = `ROLE: Policy Requirements Analyst

You are analyzing user responses to generate a structured policy requirements audit.

TOPIC: ${topic}
${notes ? `\n\nUSER'S REQUIRED KEY POINTS (MUST INCLUDE ALL):\n${notes}` : ''}

USER RESPONSES TO CLARIFYING QUESTIONS:
${answersText}

CRITICAL INSTRUCTIONS:
- MUST include ALL key points provided by the user above
- Extract UNIQUE requirements only - no repetition
- Each point should be distinct and specific
- Combine similar rules into one clear statement
- Avoid saying the same thing in different ways
- Ensure every user-provided key point is represented in the final requirements

Create a structured audit that captures:
1. All user-provided key points (mandatory)
2. Additional operational requirements from question answers (unique, non-overlapping)
3. Specific procedures mentioned (sequential steps only)
4. Edge cases or special conditions (if explicitly mentioned)
5. Scope and applicability

Return ONLY valid JSON:
{
  "title": "Clear policy title based on topic",
  "key_requirements": ["unique requirement 1", "unique requirement 2", ...],
  "procedures": ["step 1", "step 2", ...],
  "scope": "Who this applies to",
  "summary": "2-3 sentence summary of the policy"
}`;

      const auditResult = await api.invokeLLM({
        prompt: auditPrompt,
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            key_requirements: { type: "array", items: { type: "string" } },
            procedures: { type: "array", items: { type: "string" } },
            scope: { type: "string" },
            summary: { type: "string" }
          }
        }
      });

      // Directly create policy from audit
      const policyContent = formatAuditAsPolicy(auditResult);
      const audit = (auditResult != null && typeof auditResult === 'object' && 'title' in auditResult) ? auditResult : { title: '', summary: '' };
      onGenerate({
        suggested_title: audit.title,
        suggested_description: audit.summary,
        policy_content: policyContent,
        mode: "generator"
      });
      resetDialog();
    } catch (error) {
      console.error('Audit failed:', error);
      alert('Failed to generate policy');
    } finally {
      setGenerating(false);
    }
  };

  const formatAuditAsPolicy = (audit) => {
    if (!audit) return '';
    
    const lines = [];
    
    // Key Requirements section
    lines.push('Policy Rules');
    lines.push('');
    audit.key_requirements.forEach(req => {
      lines.push(`- ${req}`);
    });
    
    // Procedures section
    if (audit.procedures && audit.procedures.length > 0) {
      lines.push('');
      lines.push('Procedures');
      lines.push('');
      audit.procedures.forEach(proc => {
        lines.push(`- ${proc}`);
      });
    }
    
    // Scope
    if (audit.scope) {
      lines.push('');
      lines.push('Scope');
      lines.push('');
      lines.push(audit.scope);
    }
    
    return lines.join('\n');
  };

  const handleSelectPolicy = async (policy) => {
    setTopic(policy);
    if (!(await checkGuard())) return;
    setGenerating(true);
    try {
      const businessContext = organization?.industry ? `\nBusiness: ${organization.industry}` : '';
      const prompt = `You are helping gather information about a workplace policy topic.

Topic: ${policy}${businessContext}

Generate 3-4 brief, specific clarifying questions to better understand this policy's requirements.
Questions should focus on operational details, scope, and business-specific needs for a ${organization?.industry || 'small business'}.

Return ONLY a JSON array:
["Question 1?", "Question 2?", "Question 3?"]`;

      const result = await api.invokeLLM({
        prompt,
        add_context_from_internet: false
      });

      if (result) {
        try {
          const parsed = typeof result === 'string' ? JSON.parse(result) : result;
          setQuestions(Array.isArray(parsed) ? parsed : []);
          setAskingQuestions(true);
          setMode('topic');
        } catch (e) {
          console.error('Failed to parse questions:', e);
          alert('Failed to parse questions');
        }
      }
    } catch (error) {
      console.error('Question generation failed:', error);
      alert('Failed to generate questions');
    } finally {
      setGenerating(false);
    }
  };

  const resetDialog = () => {
    setTopic('');
    setNotes('');
    setMode(hasExistingContent ? 'topic' : 'guided');
    setAskingQuestions(false);
    setQuestions([]);
    setAnswers({});
    setSuggestedPolicies([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Smart Policy Generator
          </DialogTitle>
        </DialogHeader>

        {!hasExistingContent && (
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="guided">Guided Start</TabsTrigger>
              <TabsTrigger value="topic">Topic Generator</TabsTrigger>
            </TabsList>

            <TabsContent value="guided" className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Select a Policy to Generate</Label>
                <div className="grid gap-2">
                  {commonPolicies.map(policy => (
                    <Button
                      key={policy}
                      variant="outline"
                      className="justify-start text-left"
                      onClick={() => handleSelectPolicy(policy)}
                      disabled={generating}
                    >
                      {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {policy}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="topic" className="space-y-4">
              {!askingQuestions ? (
                <>
                  <div className="space-y-2">
                    <Label>Policy Topic</Label>
                    <Input
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      placeholder="e.g., Remote Work Policy"
                      disabled={generating}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Additional Notes (optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g., Must include time zone rules, communication hours..."
                      rows={3}
                      disabled={generating}
                    />
                  </div>
                  <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                    onClick={handleAskQuestions}
                    disabled={!topic.trim() || generating}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Asking...
                      </>
                    ) : (
                      'Next: Answer Questions'
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    {questions.map((q, i) => (
                      <div key={i} className="space-y-2">
                        <Label className="text-sm">{q}</Label>
                        <Textarea
                          value={answers[i] || ''}
                          onChange={e => setAnswers({ ...answers, [i]: e.target.value })}
                          placeholder="Your answer..."
                          rows={2}
                          disabled={generating}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setAskingQuestions(false)}
                      disabled={generating}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                      onClick={handleAuditAndGenerate}
                      disabled={Object.keys(answers).length === 0 || generating}
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating Policy...
                        </>
                      ) : (
                        'Create Policy'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}

        {hasExistingContent && (
          !askingQuestions ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Policy Topic</Label>
                <Input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g., Remote Work Policy"
                  disabled={generating}
                />
              </div>
              <div className="space-y-2">
                <Label>Additional Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g., Must include time zone rules, communication hours..."
                  rows={3}
                  disabled={generating}
                />
              </div>
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={handleAskQuestions}
                disabled={!topic.trim() || generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Asking...
                  </>
                ) : (
                  'Next: Answer Questions'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={i} className="space-y-2">
                  <Label className="text-sm">{q}</Label>
                  <Textarea
                    value={answers[i] || ''}
                    onChange={e => setAnswers({ ...answers, [i]: e.target.value })}
                    placeholder="Your answer..."
                    rows={2}
                    disabled={generating}
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAskingQuestions(false)}
                  disabled={generating}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleAuditAndGenerate}
                  disabled={Object.keys(answers).length === 0 || generating}
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Policy...
                    </>
                  ) : (
                    'Create Policy'
                  )}
                </Button>
              </div>
            </div>
          )
        )}

        <DialogFooter>
          <Button variant="outline" onClick={resetDialog}>
            {generating ? 'Wait...' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}