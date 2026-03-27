import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function PolicyReviewList({ policies, onConfirm, onPublishAsHandbook, locations, roles, departments, manualHandbook }) {
  const [selectedPolicies, setSelectedPolicies] = useState(
    policies.map((p, idx) => ({ 
      ...p, 
      id: idx, 
      selected: true, 
      expanded: false,
      action: 'create_policy' // 'create_policy' or 'add_to_handbook'
    }))
  );

  const togglePolicy = (id) => {
    setSelectedPolicies(prev =>
      prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p)
    );
  };

  const toggleExpanded = (id) => {
    setSelectedPolicies(prev =>
      prev.map(p => p.id === id ? { ...p, expanded: !p.expanded } : p)
    );
  };

  const updatePolicyTarget = (id, field, value) => {
    setSelectedPolicies(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        return {
          ...p,
          applies_to: {
            ...p.applies_to,
            [field]: value
          }
        };
      })
    );
  };

  const updatePolicyAction = (id, action) => {
    setSelectedPolicies(prev =>
      prev.map(p => p.id === id ? { ...p, action } : p)
    );
  };

  const toggleAllEmployees = (id) => {
    setSelectedPolicies(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        return {
          ...p,
          applies_to: {
            ...p.applies_to,
            all_employees: !p.applies_to?.all_employees
          }
        };
      })
    );
  };

  const handleConfirm = () => {
    const selected = selectedPolicies.filter(p => p.selected);
    const toCreate = selected.filter(p => p.action === 'create_policy');
    const toAddToHandbook = selected.filter(p => p.action === 'add_to_handbook');
    onConfirm({ toCreate, toAddToHandbook });
  };

  const selectedCount = selectedPolicies.filter(p => p.selected).length;
  const toHandbookCount = selectedPolicies.filter(p => p.selected && p.action === 'add_to_handbook').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Review Generated Policies
          </h3>
          <p className="text-sm text-slate-500">
            {selectedCount} selected {toHandbookCount > 0 && `(${toHandbookCount} to handbook)`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleConfirm} disabled={selectedCount === 0}>
            Confirm Selection
          </Button>
          <Button 
            onClick={() => onPublishAsHandbook(selectedPolicies.filter(p => p.selected))} 
            disabled={selectedCount === 0}
            variant="outline"
          >
            Publish as Complete Handbook
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {selectedPolicies.map(policy => (
          <Card key={policy.id} className={!policy.selected ? 'opacity-50' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={policy.selected}
                  onCheckedChange={() => togglePolicy(policy.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{policy.title}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {policy.handbook_category || 'General'}
                    </Badge>
                  </div>
                  {policy.description && (
                    <p className="text-sm text-slate-500 mt-1">{policy.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpanded(policy.id)}
                  disabled={!policy.selected}
                >
                  {policy.expanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardHeader>

            {policy.expanded && policy.selected && (
              <CardContent className="pt-0 space-y-4 border-t">
                <div className="pt-4">
                  <Label className="text-sm font-medium mb-2 block">Action</Label>
                  <Select
                    value={policy.action}
                    onValueChange={(v) => updatePolicyAction(policy.id, v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create_policy">Create as standalone policy</SelectItem>
                      {manualHandbook && (
                        <SelectItem value="add_to_handbook">Add to manual handbook</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {policy.action === 'create_policy' && (
                  <div className="pt-2">
                    <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                      <Settings className="w-4 h-4" />
                      Policy Targeting
                    </Label>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`all-${policy.id}`}
                        checked={policy.applies_to?.all_employees || false}
                        onCheckedChange={() => toggleAllEmployees(policy.id)}
                      />
                      <Label htmlFor={`all-${policy.id}`} className="text-sm font-normal">
                        Apply to all employees
                      </Label>
                    </div>

                    {!policy.applies_to?.all_employees && (
                      <>
                        {roles?.length > 0 && (
                          <div>
                            <Label className="text-xs text-slate-500">Roles</Label>
                            <Select
                              value={policy.applies_to?.roles?.[0] || ''}
                              onValueChange={(v) => updatePolicyTarget(policy.id, 'roles', v ? [v] : [])}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null}>All roles</SelectItem>
                                {roles.map(r => (
                                  <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {departments?.length > 0 && (
                          <div>
                            <Label className="text-xs text-slate-500">Departments</Label>
                            <Select
                              value={policy.applies_to?.departments?.[0] || ''}
                              onValueChange={(v) => updatePolicyTarget(policy.id, 'departments', v ? [v] : [])}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null}>All departments</SelectItem>
                                {departments.map(d => (
                                  <SelectItem key={d} value={d}>{d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {locations?.length > 0 && (
                          <div>
                            <Label className="text-xs text-slate-500">Locations</Label>
                            <Select
                              value={policy.applies_to?.locations?.[0] || ''}
                              onValueChange={(v) => updatePolicyTarget(policy.id, 'locations', v ? [v] : [])}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null}>All locations</SelectItem>
                                {locations.map(l => (
                                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}