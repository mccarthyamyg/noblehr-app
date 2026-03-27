import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import PageHeader from '../components/shared/PageHeader';
import DOMPurify from 'dompurify';
// Policy filtering now handled server-side via getPoliciesForEmployee backend function
import { BookOpen, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';

export default function Handbook() {
  const { org, employee } = useOrg();
  const [viewMode, setViewMode] = useState('policies');
  const [selectedHandbook, setSelectedHandbook] = useState(null);
  const [handbooks, setHandbooks] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [staticContent, setStaticContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [expandedPolicies, setExpandedPolicies] = useState(new Set());
  const [loadedVersions, setLoadedVersions] = useState({}); // policyId -> version object

  const isAdmin = employee?.permission_level === 'org_admin';

  useEffect(() => {
    if (!org) return;
    loadData();
  }, [org]);

  useEffect(() => {
    if (viewMode === 'handbook' && selectedHandbook) {
      loadHandbookContent();
    }
  }, [selectedHandbook]);

  async function ensureMainHandbook(existingHandbooks) {
    const hasMain = existingHandbooks.some(h => h.name === 'Main Handbook');
    if (hasMain) return existingHandbooks;
    const created = await api.invoke('secureEntityWrite', {
      action: 'create',
      entity_type: 'Handbook',
      organization_id: org.id,
      data: { organization_id: org.id, name: 'Main Handbook', description: 'Primary organizational handbook', status: 'active' }
    });
    return [...existingHandbooks, created.data?.data || {}];
  }

  async function loadData() {
    setLoadError(null);
    try {
      const [hRes, pRes] = await Promise.all([
        api.invoke('getHandbookData', { organization_id: org.id, action: 'list_handbooks' }),
        api.invoke('getPoliciesForEmployee', { organization_id: org.id })
      ]);
      const h = hRes.data?.handbooks || [];
      const p = pRes.data?.policies || [];

      const resolvedHandbooks = await ensureMainHandbook(h);
      setHandbooks(resolvedHandbooks);

      const mainHandbook = resolvedHandbooks.find(hb => hb.name === 'Main Handbook') || resolvedHandbooks[0];
      if (mainHandbook && !selectedHandbook) {
        setSelectedHandbook(mainHandbook.id);
      }

      const handbookPolicies = p.filter(policy =>
        ((!policy.handbook_id || policy.handbook_id === mainHandbook?.id) && policy.status !== 'archived')
      );

      setPolicies(handbookPolicies);
    } catch (e) {
      console.error(e);
      setLoadError(e.data?.error || e.message || 'Failed to load handbook');
    } finally {
      setLoading(false);
    }
  }

  async function lazyLoadVersion(policy) {
    if (loadedVersions[policy.id]) return;
    if (!policy.current_version) return;
    const res = await api.invoke('getHandbookData', {
      organization_id: org.id,
      action: 'get_policy_version',
      policy_id: policy.id,
      version_number: policy.current_version
    });
    if (res.data?.version) {
      setLoadedVersions(prev => ({ ...prev, [policy.id]: res.data.version }));
    }
  }

  async function loadHandbookContent() {
    if (!selectedHandbook) return;
    
    const handbook = handbooks.find(h => h.id === selectedHandbook);
    if (!handbook) return;

    // If handbook has dynamic policy sections, load those policies
    if (handbook.policy_sections && handbook.policy_sections.length > 0) {
      const allPolicyIds = handbook.policy_sections.flatMap(s => s.policy_ids || []);
      const pRes2 = await api.invoke('getPoliciesForEmployee', { organization_id: org.id });
      const visiblePolicies = (pRes2.data?.policies || []).filter(p => allPolicyIds.includes(p.id) && p.status !== 'archived');
      setPolicies(visiblePolicies);
    } else {
      // Legacy static content handbook
      const res = await api.invoke('getHandbookData', {
        organization_id: org.id,
        action: 'get_handbook_version',
        handbook_id: selectedHandbook
      });
      if (res.data?.version) {
        setStaticContent(res.data.version.content);
      }
    }
  }

  // Policy filtering moved to server-side for security

  function toggleSection(section) {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  }

  function togglePolicy(policy) {
    const policyId = policy.id;
    const newExpanded = new Set(expandedPolicies);
    if (newExpanded.has(policyId)) {
      newExpanded.delete(policyId);
    } else {
      newExpanded.add(policyId);
      lazyLoadVersion(policy);
    }
    setExpandedPolicies(newExpanded);
  }

  // Group policies by handbook_category
  const categoryLabels = {
    'Scheduling': 'Scheduling & Time Off',
    'Safety': 'Safety & Workplace Conduct',
    'Operations': 'Operations & Procedures',
    'Compensation': 'Compensation & Benefits',
    'Conduct': 'Code of Conduct',
    'Other': 'Other'
  };

  // Color scheme for each category
  const categoryColors = {
    'Scheduling': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', hover: 'hover:bg-blue-100' },
    'Safety': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', hover: 'hover:bg-red-100' },
    'Operations': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', hover: 'hover:bg-purple-100' },
    'Compensation': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', hover: 'hover:bg-green-100' },
    'Conduct': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', hover: 'hover:bg-amber-100' },
    'Other': { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900', hover: 'hover:bg-slate-100' }
  };

  const sections = {};

  policies.forEach(policy => {
    const categoryKey = policy.handbook_category || 'Other';
    const categoryTitle = categoryLabels[categoryKey] || categoryKey || 'Other Policies';
    if (!sections[categoryKey]) {
      sections[categoryKey] = { title: categoryTitle, policies: [] };
    }
    sections[categoryKey].policies.push(policy);
  });

  // Filter out empty sections and sort by policy count (descending)
  const visibleSections = Object.entries(sections)
    .filter(([_, section]) => section.policies.length > 0)
    .sort((a, b) => b[1].policies.length - a[1].policies.length);

  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading handbook...</div>;

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Could not load handbook</p>
          <p className="text-sm text-red-600 mt-1">{loadError}</p>
          <button
            type="button"
            onClick={() => loadData()}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Company Handbook"
        description={viewMode === 'policies' 
          ? `${org?.name} — Compiled from ${policies.length} published ${policies.length === 1 ? 'policy' : 'policies'}`
          : `${org?.name} — AI-Generated Handbook`
        }
      />

      <div className="mb-6">
        <Select value={viewMode} onValueChange={(v) => {
          setViewMode(v);
          if (v === 'handbook' && handbooks.length > 0 && !selectedHandbook) {
            setSelectedHandbook(handbooks[0].id);
          }
        }}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="policies">Policy Handbook (Dynamic)</SelectItem>
            {handbooks.map(h => (
              <SelectItem key={h.id} value="handbook" onClick={() => setSelectedHandbook(h.id)}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {viewMode === 'policies' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Dynamic Handbook View</p>
              <p className="text-xs text-blue-700 mt-1">
                This handbook is automatically compiled from all active published policies. 
                {!isAdmin && ' You see only policies that apply to your role, department, and location.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'handbook' && (
        <>
          {handbooks.find(h => h.id === selectedHandbook)?.policy_sections ? (
            // Dynamic handbook - render like policies view
            policies.length === 0 ? (
              <Card className="p-12 text-center">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No policies in this handbook.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {visibleSections.map(([key, section]) => {
                  const isExpanded = expandedSections.has(key);
                  const colors = categoryColors[key] || categoryColors['Other'];
                  return (
                    <Card key={key} className={`overflow-hidden border-2 ${colors.border}`}>
                      <button
                        onClick={() => toggleSection(key)}
                        className={`w-full flex items-center justify-between p-5 ${colors.bg} ${colors.hover} transition-colors text-left`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {isExpanded ? (
                            <ChevronDown className={`w-5 h-5 flex-shrink-0 ${colors.text}`} />
                          ) : (
                            <ChevronRight className={`w-5 h-5 flex-shrink-0 ${colors.text}`} />
                          )}
                          <h2 className={`text-lg font-semibold ${colors.text} truncate`}>{section.title}</h2>
                          <span className={`text-xs ${colors.text} opacity-70 flex-shrink-0`}>({section.policies.length})</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-100 divide-y divide-slate-100">
                          {section.policies.map(policy => {
                            const version = loadedVersions[policy.id];
                            const isPolicyExpanded = expandedPolicies.has(policy.id);
                            return (
                              <div key={policy.id} className="hover:bg-slate-50/50 transition-colors">
                                <button
                                  onClick={() => togglePolicy(policy)}
                                  className="w-full flex items-start gap-3 p-5 text-left"
                                >
                                  <div className="flex items-center gap-2 mt-0.5 flex-shrink-0">
                                    {isPolicyExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-slate-400" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-slate-400" />
                                    )}
                                    <FileText className="w-4 h-4 text-indigo-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h3 className="text-base font-semibold text-slate-900">{policy.title}</h3>
                                      <span className="text-xs text-slate-400">v{version?.version_number || 1}</span>
                                    </div>
                                  </div>
                                </button>
                                {isPolicyExpanded && (
                                  <div className="px-5 pb-5 border-t border-slate-100">
                                    {policy.description && (
                                      <p className="text-sm text-slate-600 mb-3 mt-3">{policy.description}</p>
                                    )}
                                    <style dangerouslySetInnerHTML={{ __html: `
                                      .handbook-policy-content,
                                      .handbook-policy-content *,
                                      .prose,
                                      .prose * {
                                        overflow: visible !important;
                                        -webkit-overflow-scrolling: auto !important;
                                        max-height: none !important;
                                      }
                                      .handbook-policy-content *::-webkit-scrollbar,
                                      .prose *::-webkit-scrollbar {
                                        display: none !important;
                                        width: 0 !important;
                                        height: 0 !important;
                                        -webkit-appearance: none !important;
                                      }
                                      .handbook-policy-content ul,
                                      .handbook-policy-content ol {
                                        display: block !important;
                                        margin: 1em 0 !important;
                                        padding-left: 2em !important;
                                      }
                                      .handbook-policy-content li {
                                        display: list-item !important;
                                        list-style-position: outside !important;
                                        margin-bottom: 0.5em !important;
                                      }
                                      .handbook-policy-content ul li {
                                        list-style-type: disc !important;
                                      }
                                      .handbook-policy-content ol li {
                                        list-style-type: decimal !important;
                                      }
                                    `}} />
                                    <div
                                      className="handbook-policy-content prose prose-sm prose-slate max-w-none"
                                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(version?.content || '<p>No content available.</p>') }}
                                    />
                                    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
                                      <span className="text-xs text-slate-400">
                                        Last updated: {format(new Date(version?.created_date || policy.updated_date), 'MMMM d, yyyy')}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )
          ) : (
            // Legacy static content handbook
            staticContent && (
              <Card className="p-8 mb-8">
                <div
                  className="prose prose-slate max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(staticContent) }}
                />
              </Card>
            )
          )}
        </>
      )}

      {viewMode === 'policies' && visibleSections.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No policies available in the handbook.</p>
        </Card>
      ) : viewMode === 'policies' ? (
        <div className="space-y-4">
          {visibleSections.map(([key, section]) => {
            const isExpanded = expandedSections.has(key);
            const colors = categoryColors[key] || categoryColors['Other'];
            return (
              <Card key={key} className={`overflow-hidden border-2 ${colors.border}`}>
                <button
                  onClick={() => toggleSection(key)}
                  className={`w-full flex items-center justify-between p-5 ${colors.bg} ${colors.hover} transition-colors text-left`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isExpanded ? (
                      <ChevronDown className={`w-5 h-5 flex-shrink-0 ${colors.text}`} />
                    ) : (
                      <ChevronRight className={`w-5 h-5 flex-shrink-0 ${colors.text}`} />
                    )}
                    <h2 className={`text-lg font-semibold ${colors.text} truncate`}>{section.title}</h2>
                    <span className={`text-xs ${colors.text} opacity-70 flex-shrink-0`}>({section.policies.length})</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {section.policies.map(policy => {
                       const version = loadedVersions[policy.id];
                       const isPolicyExpanded = expandedPolicies.has(policy.id);
                       return (
                         <div key={policy.id} className="hover:bg-slate-50/50 transition-colors">
                           <button
                             onClick={() => togglePolicy(policy)}
                             className="w-full flex items-start gap-3 p-5 text-left"
                           >
                             <div className="flex items-center gap-2 mt-0.5 flex-shrink-0">
                               {isPolicyExpanded ? (
                                 <ChevronDown className="w-4 h-4 text-slate-400" />
                               ) : (
                                 <ChevronRight className="w-4 h-4 text-slate-400" />
                               )}
                               <FileText className="w-4 h-4 text-indigo-600" />
                             </div>
                             <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-2">
                                 <h3 className="text-base font-semibold text-slate-900">{policy.title}</h3>
                                 <span className="text-xs text-slate-400">v{version?.version_number || 1}</span>
                               </div>
                             </div>
                           </button>
                           {isPolicyExpanded && (
                             <div className="px-5 pb-5 border-t border-slate-100">
                               {policy.description && (
                                 <p className="text-sm text-slate-600 mb-3 mt-3">{policy.description}</p>
                               )}
                               <style dangerouslySetInnerHTML={{ __html: `
                                 /* Disable ALL scrolling in handbook policy content */
                                 .handbook-policy-content,
                                 .handbook-policy-content *,
                                 .prose,
                                 .prose * {
                                   overflow: visible !important;
                                   -webkit-overflow-scrolling: auto !important;
                                   max-height: none !important;
                                 }

                                 /* Hide ALL webkit scrollbar UI */
                                 .handbook-policy-content *::-webkit-scrollbar,
                                 .prose *::-webkit-scrollbar {
                                   display: none !important;
                                   width: 0 !important;
                                   height: 0 !important;
                                   -webkit-appearance: none !important;
                                 }

                                 .handbook-policy-content *::-webkit-scrollbar-button,
                                 .prose *::-webkit-scrollbar-button {
                                   display: none !important;
                                   height: 0 !important;
                                   width: 0 !important;
                                 }

                                 /* Ensure lists display properly */
                                 .handbook-policy-content ul,
                                 .handbook-policy-content ol {
                                   display: block !important;
                                   margin: 1em 0 !important;
                                   padding-left: 2em !important;
                                 }

                                 .handbook-policy-content li {
                                   display: list-item !important;
                                   list-style-position: outside !important;
                                   margin-bottom: 0.5em !important;
                                 }

                                 .handbook-policy-content ul li {
                                   list-style-type: disc !important;
                                 }

                                 .handbook-policy-content ol li {
                                   list-style-type: decimal !important;
                                 }
                               `}} />
                               <div
                                 className="handbook-policy-content prose prose-sm prose-slate max-w-none"
                                 dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(version?.content || '<p>No content available.</p>') }}
                               />
                               <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
                                 <span className="text-xs text-slate-400">
                                   Last updated: {format(new Date(version?.created_date || policy.updated_date), 'MMMM d, yyyy')}
                                 </span>
                                 {policy.tags?.length > 0 && (
                                   <div className="flex gap-1.5">
                                     {policy.tags.slice(0, 4).map(tag => (
                                       <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                                         {tag}
                                       </span>
                                     ))}
                                   </div>
                                 )}
                               </div>
                             </div>
                           )}
                         </div>
                       );
                     })}
                    </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}